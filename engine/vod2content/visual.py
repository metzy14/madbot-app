"""
Visual analysis for highlight detection – GPU-accelerated when available.

Tiers (best → fallback):
  1. YOLO vehicle detection (ultralytics) on GPU  → cars, relative motion, pile-ups
  2. OpenCV optical flow (CUDA if present)
  3. PyTorch GPU frame-difference motion
  4. NumPy CPU frame-difference (always works)

Especially important for iRacing where crashes, spins and close battles
have strong visual signatures that pure audio misses.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import av


@dataclass
class MotionPeak:
    time: float
    score: float
    reason: str = "motion"


def _torch_device():
    try:
        import torch
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")
    except ImportError:
        return None


class VisualAnalyzer:
    """
    Compute visual excitement scores over time.
    Automatically uses GPU when PyTorch CUDA (or YOLO) is available.
    """

    @staticmethod
    def recommended_sample_fps(duration_sec: float, use_yolo: bool = False) -> float:
        """
        For 3–8 hour VODs, dense sampling is impractical (especially YOLO on CPU).
        Returns frames-per-second to sample.
        """
        hours = duration_sec / 3600.0
        if use_yolo:
            # YOLO is heavy — very sparse on long VODs
            if hours >= 4:
                return 0.1   # 1 frame / 10s
            if hours >= 2:
                return 0.15  # 1 frame / ~7s
            if hours >= 1:
                return 0.25
            if hours >= 0.5:
                return 0.5
            return 1.0
        # Fast frame-diff / optical flow — still sparse on long VODs
        if hours >= 4:
            return 0.2   # 1 frame / 5s
        if hours >= 2:
            return 0.3
        if hours >= 1:
            return 0.5
        if hours >= 0.5:
            return 1.0
        return 2.0

    def __init__(
        self,
        sample_fps: float = 2.0,
        resize_width: int = 480,
        use_yolo: bool = True,
        yolo_model: str = "yolov8n.pt",
        yolo_conf: float = 0.35,
    ):
        self.sample_fps = sample_fps
        self.resize_width = resize_width
        self.use_yolo = use_yolo
        self.yolo_model_name = yolo_model
        self.yolo_conf = yolo_conf

        self.device = _torch_device()
        self._has_cv2 = False
        self._yolo = None
        self._backend = "numpy"
        self._yolo_device = "cpu"

        try:
            import cv2  # noqa: F401
            self._has_cv2 = True
        except ImportError:
            pass

        if self.use_yolo:
            self._try_load_yolo()

        if self._yolo is not None:
            self._backend = "yolo"
        elif self.device is not None and str(self.device).startswith("cuda"):
            self._backend = "torch_cuda"
        elif self._has_cv2:
            self._backend = "opencv"
        else:
            self._backend = "numpy"

    def _try_load_yolo(self):
        """Load ultralytics YOLO if installed. Model downloads on first use.
        Falls back to CPU if GPU is present but unsupported (e.g. new arch sm_120).
        """
        try:
            from ultralytics import YOLO
            import torch
            self._yolo = YOLO(self.yolo_model_name)
            device = "cpu"
            if torch.cuda.is_available():
                try:
                    # Probe: allocate a tiny tensor and run a trivial op
                    t = torch.zeros(1, device="cuda")
                    _ = t + 1
                    del t
                    torch.cuda.empty_cache()
                    device = 0
                except Exception as e:
                    print(f"   CUDA present but unusable ({e.__class__.__name__}) — YOLO on CPU")
                    device = "cpu"
            self._yolo_device = device
            print(f"   YOLO loaded ({self.yolo_model_name}) on device={device}")
        except Exception as e:
            print(f"   YOLO not available: {e}")
            self._yolo = None

    @property
    def backend(self) -> str:
        return self._backend

    def has_gpu(self) -> bool:
        return self.device is not None and "cuda" in str(self.device)

    def has_yolo(self) -> bool:
        return self._yolo is not None

    def _iter_frames(self, video_path: str, max_duration: Optional[float] = None):
        container = av.open(video_path)
        stream = container.streams.video[0]
        stream.thread_type = "AUTO"
        target_interval = 1.0 / self.sample_fps
        next_sample_t = 0.0

        for frame in container.decode(video=0):
            t = float(frame.time) if frame.time is not None else 0.0
            if t < next_sample_t:
                continue
            if max_duration and t > max_duration:
                break
            img = frame.to_ndarray(format="rgb24")
            yield t, img
            next_sample_t += target_interval
        container.close()

    def _resize(self, img: np.ndarray) -> np.ndarray:
        h, w = img.shape[:2]
        if w <= self.resize_width:
            return img
        new_h = int(h * self.resize_width / w)
        if self._has_cv2:
            import cv2
            return cv2.resize(img, (self.resize_width, new_h), interpolation=cv2.INTER_AREA)
        y_idx = (np.linspace(0, h - 1, new_h)).astype(np.int32)
        x_idx = (np.linspace(0, w - 1, self.resize_width)).astype(np.int32)
        return img[y_idx][:, x_idx]

    def _motion_yolo(self, video_path: str, max_duration: Optional[float] = None):
        """Vehicle density + pack motion. Great for iRacing incidents."""
        VEHICLE_IDS = {2, 3, 5, 7}  # car, motorcycle, bus, truck (COCO)

        times, scores = [], []
        prev_centroids = None
        prev_count = 0

        for t, img in self._iter_frames(video_path, max_duration):
            img_r = self._resize(img)
            results = self._yolo.predict(
                img_r,
                conf=self.yolo_conf,
                classes=list(VEHICLE_IDS),
                verbose=False,
                device=self._yolo_device,
            )
            boxes = results[0].boxes
            count = len(boxes) if boxes is not None else 0
            centroids = []
            areas = []
            if count > 0:
                xyxy = boxes.xyxy.cpu().numpy()
                for x1, y1, x2, y2 in xyxy:
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                    centroids.append([cx, cy])
                    areas.append((x2 - x1) * (y2 - y1))

            motion = 0.0
            if prev_centroids is not None and centroids and prev_centroids:
                curr = np.array(centroids)
                prev = np.array(prev_centroids)
                motion = float(np.linalg.norm(curr.mean(0) - prev.mean(0)))
                count_delta = abs(count - prev_count)
                motion += count_delta * 30.0

            density = count * (np.mean(areas) if areas else 1.0)
            score = density * 0.4 + motion * 0.6

            times.append(t)
            scores.append(score)
            prev_centroids = centroids
            prev_count = count

        return self._normalize(times, scores)

    def _motion_torch(self, video_path: str, max_duration: Optional[float] = None):
        import torch

        device = self.device
        # If CUDA device is broken (unsupported arch), force CPU
        try:
            if device is not None and "cuda" in str(device):
                t = torch.zeros(1, device=device)
                _ = t + 1
                del t
        except Exception:
            print("   CUDA unusable for frame-diff — using CPU")
            device = torch.device("cpu")

        times, scores = [], []
        prev = None

        try:
            for t, img in self._iter_frames(video_path, max_duration):
                img_r = self._resize(img)
                ten = torch.from_numpy(img_r).permute(2, 0, 1).float().div_(255.0).to(device)
                if prev is not None:
                    diff = (ten - prev).abs().mean().item()
                    times.append(t)
                    scores.append(diff)
                prev = ten
        except Exception as e:
            print(f"   Torch motion failed ({e}) — falling back to NumPy")
            return self._motion_numpy(video_path, max_duration)

        return self._normalize(times, scores)

    def _motion_opencv(self, video_path: str, max_duration: Optional[float] = None):
        import cv2

        times, scores = [], []
        prev_gray = None

        for t, img in self._iter_frames(video_path, max_duration):
            img_r = self._resize(img)
            gray = cv2.cvtColor(img_r, cv2.COLOR_RGB2GRAY)
            if prev_gray is not None:
                flow = cv2.calcOpticalFlowFarneback(
                    prev_gray, gray, None, 0.5, 3, 15, 3, 5, 1.2, 0
                )
                mag = np.sqrt(flow[..., 0] ** 2 + flow[..., 1] ** 2)
                score = float(np.mean(mag))
                times.append(t)
                scores.append(score)
            prev_gray = gray

        return self._normalize(times, scores)

    def _motion_numpy(self, video_path: str, max_duration: Optional[float] = None):
        times, scores = [], []
        prev = None

        for t, img in self._iter_frames(video_path, max_duration):
            img_r = self._resize(img).astype(np.float32)
            gray = img_r.mean(axis=2) if img_r.ndim == 3 else img_r
            if prev is not None:
                diff = float(np.mean(np.abs(gray - prev)))
                times.append(t)
                scores.append(diff)
            prev = gray

        return self._normalize(times, scores)

    def _normalize(self, times, scores):
        if not scores:
            return np.array([]), np.array([])
        t = np.array(times)
        s = np.array(scores, dtype=np.float64)
        if s.max() > 0:
            s = s / s.max()
        if len(s) > 5:
            s = np.convolve(s, np.ones(3) / 3, mode="same")
        return t, s

    def compute_motion_timeline(
        self,
        video_path: str,
        max_duration: Optional[float] = None,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Returns (times, motion_scores) normalized 0–1. Picks best backend.
        Always falls back if a higher tier fails (e.g. unsupported CUDA arch).
        """
        errors = []
        if self._yolo is not None:
            try:
                print(f"   Visual backend: YOLO ({self.yolo_model_name}) on {self._yolo_device}")
                return self._motion_yolo(video_path, max_duration)
            except Exception as e:
                errors.append(f"YOLO: {e}")
                print(f"   YOLO failed ({e.__class__.__name__}) — trying next backend")
                # If CUDA failed, force YOLO to CPU for retry once
                if self._yolo_device != "cpu":
                    try:
                        self._yolo_device = "cpu"
                        print("   Retrying YOLO on CPU...")
                        return self._motion_yolo(video_path, max_duration)
                    except Exception as e2:
                        errors.append(f"YOLO-CPU: {e2}")
                        print(f"   YOLO CPU also failed: {e2.__class__.__name__}")

        if self.device is not None:
            try:
                print("   Visual backend: PyTorch frame-difference")
                return self._motion_torch(video_path, max_duration)
            except Exception as e:
                errors.append(f"torch: {e}")
                print(f"   Torch motion failed — trying next backend")

        if self._has_cv2:
            try:
                print("   Visual backend: OpenCV optical flow")
                return self._motion_opencv(video_path, max_duration)
            except Exception as e:
                errors.append(f"opencv: {e}")
                print(f"   OpenCV failed — falling back to NumPy")

        print("   Visual backend: NumPy CPU frame-difference")
        return self._motion_numpy(video_path, max_duration)

    def detect_motion_peaks(
        self,
        video_path: str,
        game: str = "generic",
        top_n: int = 30,
        min_score: float = 0.35,
    ) -> List[MotionPeak]:
        from .game_profiles import get_profile
        profile = get_profile(game)
        times, motion = self.compute_motion_timeline(video_path)
        if len(motion) == 0:
            return []

        if profile.id == "iracing":
            thresh = max(min_score, np.percentile(motion, 80))
        else:
            thresh = max(min_score, np.percentile(motion, 88))

        candidates = []
        for i in range(1, len(motion) - 1):
            if motion[i] >= thresh and motion[i] >= motion[i - 1] and motion[i] >= motion[i + 1]:
                reason = "high_motion"
                if profile.id == "iracing" and motion[i] > 0.7:
                    reason = "possible_incident"
                candidates.append(MotionPeak(time=float(times[i]), score=float(motion[i]), reason=reason))

        candidates.sort(key=lambda p: p.score, reverse=True)
        return candidates[:top_n]
