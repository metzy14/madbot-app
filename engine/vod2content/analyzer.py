"""
Video and audio analysis for highlight detection, energy peaks, and metadata.
Game-aware: different games have different "excitement" signatures.
"""

import os
import json
import subprocess
import tempfile
from dataclasses import dataclass, asdict
from typing import List, Tuple, Optional, Dict, Any
from pathlib import Path

import numpy as np
from scipy import signal
from pydub import AudioSegment
from pydub.silence import detect_nonsilent

from .game_profiles import GameProfile, get_profile, PROFILES


@dataclass
class VideoMetadata:
    path: str
    duration: float
    width: int
    height: int
    fps: float
    codec: str
    audio_codec: Optional[str]
    bitrate: Optional[int]
    has_audio: bool
    aspect_ratio: float

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class HighlightSegment:
    start: float
    end: float
    score: float
    reason: str
    game_profile: str = "generic"

    @property
    def duration(self) -> float:
        return self.end - self.start


class VideoAnalyzer:
    """Analyze VODs/clips with optional game-specific excitement models."""

    def __init__(self, ffmpeg_path: str = "ffmpeg", ffprobe_path: str = "ffprobe"):
        self.ffmpeg = ffmpeg_path
        self.ffprobe = ffprobe_path

    def get_metadata(self, video_path: str) -> VideoMetadata:
        cmd = [
            self.ffprobe, "-v", "quiet", "-print_format", "json",
            "-show_format", "-show_streams", video_path
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            data = json.loads(result.stdout)
        except Exception as e:
            raise RuntimeError(f"ffprobe failed on {video_path}: {e}")

        video_stream = next((s for s in data.get("streams", []) if s["codec_type"] == "video"), None)
        audio_stream = next((s for s in data.get("streams", []) if s["codec_type"] == "audio"), None)
        fmt = data.get("format", {})

        if not video_stream:
            raise ValueError(f"No video stream found in {video_path}")

        width = int(video_stream.get("width", 0))
        height = int(video_stream.get("height", 0))
        duration = float(fmt.get("duration") or video_stream.get("duration") or 0)
        fps_str = video_stream.get("r_frame_rate", "30/1")
        if "/" in fps_str:
            num, den = map(int, fps_str.split("/"))
            fps = num / den if den else 30.0
        else:
            fps = float(fps_str)

        return VideoMetadata(
            path=video_path,
            duration=duration,
            width=width,
            height=height,
            fps=fps,
            codec=video_stream.get("codec_name", "unknown"),
            audio_codec=audio_stream.get("codec_name") if audio_stream else None,
            bitrate=int(fmt.get("bit_rate", 0)) or None,
            has_audio=audio_stream is not None,
            aspect_ratio=width / height if height else 1.0,
        )

    def extract_audio_segment(
        self,
        video_path: str,
        start: float = 0,
        duration: Optional[float] = None,
        sample_rate: int = 22050,
    ) -> AudioSegment:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            cmd = [self.ffmpeg, "-y", "-i", video_path, "-ss", str(start)]
            if duration:
                cmd += ["-t", str(duration)]
            cmd += ["-vn", "-acodec", "pcm_s16le", "-ar", str(sample_rate), "-ac", "1", tmp_path]
            subprocess.run(cmd, capture_output=True, check=True)
            return AudioSegment.from_wav(tmp_path)
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    def _compute_band_energies(
        self,
        samples: np.ndarray,
        sr: int,
        window_ms: int,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Returns (times, total_rms, band_energies[n_frames, 5])
        Bands: sub(0-150), low(150-400), mid(400-2k), high(2k-6k), presence(6k+)
        """
        frame_len = max(1, int(sr * window_ms / 1000))
        hop = frame_len  # non-overlapping for speed
        n_frames = len(samples) // hop
        if n_frames < 2:
            return np.array([]), np.array([]), np.zeros((0, 5))

        samples = samples[: n_frames * hop].astype(np.float32)
        frames = samples.reshape(n_frames, hop)

        # RMS total
        rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)

        # Simple FFT-based band energies (real FFT)
        freqs = np.fft.rfftfreq(hop, d=1.0 / sr)
        band_edges = [0, 150, 400, 2000, 6000, sr / 2]
        band_e = np.zeros((n_frames, 5), dtype=np.float32)

        # Vectorized-ish: compute spectrum per frame in batches if needed
        # For long VODs we already chunk, so this is fine
        specs = np.abs(np.fft.rfft(frames, axis=1)) ** 2
        for b in range(5):
            mask = (freqs >= band_edges[b]) & (freqs < band_edges[b + 1])
            if mask.any():
                band_e[:, b] = np.sqrt(specs[:, mask].mean(axis=1) + 1e-12)

        times = np.arange(n_frames) * (window_ms / 1000.0)
        return times, rms, band_e

    def detect_highlights(
        self,
        video_path: str,
        game: str = "generic",
        top_n: int = 20,
        custom_profile: Optional[GameProfile] = None,
        use_visual: bool = True,
    ) -> List[HighlightSegment]:
        """
        Game-aware highlight detection.
        Fuses:
          - Audio energy + spectral shape + transients (always)
          - Visual motion energy (especially important for iRacing)
        """
        from .visual import VisualAnalyzer

        profile = custom_profile or get_profile(game)
        meta = self.get_metadata(video_path)

        # ----- Visual motion timeline (sparse on long VODs) -----
        # 3–8 hour streams cannot run dense YOLO; audio leads, visual is a light assist.
        visual_times = np.array([])
        visual_scores = np.array([])
        if use_visual:
            try:
                duration = meta.duration or 0.0
                hours = duration / 3600.0
                # YOLO only on short clips; long VODs use fast frame-diff at low FPS
                use_yolo = duration < 1800  # under 30 minutes
                sample_fps = VisualAnalyzer.recommended_sample_fps(duration, use_yolo=use_yolo)
                # iRacing benefits slightly more from visual — bump a little if not huge
                if profile.id == "iracing" and hours < 3:
                    sample_fps = min(sample_fps * 1.25, 2.0)

                print(f"   Long-VOD mode: duration={hours:.1f}h  sample_fps={sample_fps:.2f}  yolo={use_yolo}")
                va = VisualAnalyzer(
                    sample_fps=sample_fps,
                    resize_width=480 if hours >= 1 else 640,
                    use_yolo=use_yolo,
                )
                visual_times, visual_scores = va.compute_motion_timeline(video_path)
                print(f"   Visual motion analysis: {len(visual_scores)} samples")
            except Exception as e:
                print(f"   Visual analysis skipped: {e}")

        # How much to trust visual vs audio (game dependent)
        if profile.id == "iracing":
            visual_weight = 0.55   # motion is critical for racing
            audio_weight = 0.45
        elif profile.id in ("tarkov", "fps", "battle_royale"):
            visual_weight = 0.25
            audio_weight = 0.75
        else:
            visual_weight = 0.30
            audio_weight = 0.70

        # Longer chunks on long VODs = fewer ffmpeg launches
        if meta.duration >= 7200:      # 2h+
            chunk_len = 300.0
        elif meta.duration >= 3600:    # 1h+
            chunk_len = 180.0
        else:
            chunk_len = 90.0
        all_times: List[float] = []
        all_scores: List[float] = []
        all_reasons: List[str] = []

        sr = 16000 if meta.duration >= 3600 else 22050  # lighter audio on long VODs
        has_audio = meta.has_audio
        print(f"   Audio analysis: chunk_len={chunk_len:.0f}s  sr={sr}")

        for chunk_start in np.arange(0, meta.duration, chunk_len):
            dur = min(chunk_len, meta.duration - chunk_start)
            if dur < 2.0:
                continue

            energy = spectral = transient = sustained = None
            times = None

            if has_audio:
                try:
                    audio = self.extract_audio_segment(video_path, start=chunk_start, duration=dur, sample_rate=sr)
                    samples = np.array(audio.get_array_of_samples()).astype(np.float32)
                    if audio.channels > 1:
                        samples = samples.reshape((-1, audio.channels)).mean(axis=1)
                    if np.max(np.abs(samples)) > 0:
                        samples = samples / np.max(np.abs(samples))

                    times, rms, band_e = self._compute_band_energies(samples, sr, profile.window_ms)
                    if len(times) >= 3:
                        times = times + chunk_start
                        energy = rms / (rms.max() + 1e-9)
                        weights = np.array(profile.band_weights, dtype=np.float32)
                        weights = weights / (weights.sum() + 1e-9)
                        spectral = (band_e * weights).sum(axis=1)
                        spectral = spectral / (spectral.max() + 1e-9)
                        transient = np.zeros_like(energy)
                        transient[1:] = np.maximum(0, energy[1:] - energy[:-1])
                        if transient.max() > 0:
                            transient = transient / transient.max()
                except Exception:
                    pass

            if times is None or energy is None:
                # No audio – fall back to visual-only grid for this chunk
                if len(visual_times) == 0:
                    continue
                mask = (visual_times >= chunk_start) & (visual_times < chunk_start + dur)
                if not mask.any():
                    continue
                times = visual_times[mask]
                energy = visual_scores[mask]
                spectral = energy.copy()
                transient = np.zeros_like(energy)
                transient[1:] = np.maximum(0, energy[1:] - energy[:-1])

            # 4. Sustained energy (local average)
            kernel = max(3, int(1500 / profile.window_ms))
            sustained = np.convolve(energy, np.ones(kernel) / kernel, mode="same")
            if sustained.max() > 0:
                sustained = sustained / sustained.max()

            # 5. Visual motion (interpolate onto audio timeline)
            vis = np.zeros_like(energy)
            if len(visual_times) > 0 and len(visual_scores) > 0:
                vis = np.interp(times, visual_times, visual_scores, left=0.0, right=0.0)

            # Combine according to profile + visual weight
            w = profile.score_weights
            audio_score = (
                w.get("energy", 1.0) * energy
                + w.get("transient", 0.6) * transient * profile.transient_boost
                + w.get("sustained", 0.4) * sustained * (1.3 if profile.prefer_sustained else 0.7)
                + w.get("spectral_match", 0.8) * spectral
            )
            if audio_score.max() > 0:
                audio_score = audio_score / audio_score.max()

            score = audio_weight * audio_score + visual_weight * vis
            if score.max() > 0:
                score = score / score.max()

            all_times.extend(times.tolist())
            all_scores.extend(score.tolist())

            # Reason tags
            for i in range(len(times)):
                reasons = []
                if vis[i] > 0.65:
                    reasons.append("motion" if profile.id != "iracing" else "incident")
                if transient[i] > 0.6:
                    reasons.append("impact" if profile.id in ("iracing", "sports") else "gunfight")
                if sustained[i] > 0.7 and profile.prefer_sustained:
                    reasons.append("high_rpm" if profile.id == "iracing" else "sustained")
                if spectral[i] > 0.75:
                    reasons.append("spectral")
                all_reasons.append("+".join(reasons) if reasons else "energy")

        if not all_scores:
            return []

        times_arr = np.array(all_times)
        scores_arr = np.array(all_scores)

        # Threshold
        thresh = np.percentile(scores_arr, profile.top_percentile)
        candidates_idx = np.where(scores_arr >= thresh)[0]

        # Non-maximum suppression + local maxima
        peaks = []
        for i in candidates_idx:
            if i == 0 or i == len(scores_arr) - 1:
                continue
            if scores_arr[i] >= scores_arr[i - 1] and scores_arr[i] >= scores_arr[i + 1]:
                peaks.append((times_arr[i], scores_arr[i], all_reasons[i]))

        # Sort by score
        peaks.sort(key=lambda x: x[1], reverse=True)

        segments: List[HighlightSegment] = []
        used: List[Tuple[float, float]] = []

        for peak_t, score, reason in peaks:
            # Build segment around peak using profile pre/post roll
            target_len = profile.ideal_segment
            pre = target_len * profile.pre_roll
            post = target_len * profile.post_roll
            seg_start = max(0.0, peak_t - pre)
            seg_end = min(meta.duration, peak_t + post)

            # Clamp to profile min/max
            if seg_end - seg_start < profile.min_segment:
                extra = (profile.min_segment - (seg_end - seg_start)) / 2
                seg_start = max(0.0, seg_start - extra)
                seg_end = min(meta.duration, seg_end + extra)
            if seg_end - seg_start > profile.max_segment:
                mid = (seg_start + seg_end) / 2
                half = profile.max_segment / 2
                seg_start = max(0.0, mid - half)
                seg_end = min(meta.duration, mid + half)

            # Overlap rejection
            overlap = any(not (seg_end < us or seg_start > ue) for us, ue in used)
            if overlap:
                continue

            used.append((seg_start, seg_end))
            segments.append(HighlightSegment(
                start=round(seg_start, 2),
                end=round(seg_end, 2),
                score=round(float(score), 3),
                reason=reason,
                game_profile=profile.id,
            ))
            if len(segments) >= top_n:
                break

        segments.sort(key=lambda s: s.start)
        return segments


    def detect_highlights_turbo(
        self,
        video_path: str,
        game: str = "generic",
        top_n: int = 12,
        custom_profile: Optional[GameProfile] = None,
    ) -> List[HighlightSegment]:
        """
        Fast path for 3–8 hour VODs (aim: analysis in a few minutes).
        - One audio extract at low sample rate
        - NumPy RMS peaks only (no visual, no YOLO, no per-chunk ffmpeg)
        """
        import tempfile
        import subprocess
        profile = custom_profile or get_profile(game)
        meta = self.get_metadata(video_path)
        if not meta.has_audio or meta.duration <= 0:
            return []

        print(f"   TURBO mode: single-pass audio for {meta.duration/3600:.1f}h VOD")
        sr = 8000  # low SR = fast decode + small array
        window_s = max(0.5, profile.window_ms / 1000.0)
        # Prefer ~1s windows on very long files
        if meta.duration >= 7200:
            window_s = 1.0
        elif meta.duration >= 3600:
            window_s = 0.75

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = tmp.name
        try:
            cmd = [
                self.ffmpeg, "-y", "-i", video_path,
                "-vn", "-ac", "1", "-ar", str(sr),
                "-acodec", "pcm_s16le",
                wav_path,
            ]
            # show progress lightly
            print("   Extracting audio (one pass)…")
            subprocess.run(cmd, capture_output=True, check=True)
            from pydub import AudioSegment
            audio = AudioSegment.from_wav(wav_path)
            samples = np.array(audio.get_array_of_samples()).astype(np.float32)
            if audio.channels > 1:
                samples = samples.reshape((-1, audio.channels)).mean(axis=1)
            if samples.max() > 0:
                samples = samples / (np.max(np.abs(samples)) + 1e-9)

            frame = max(1, int(sr * window_s))
            n = len(samples) // frame
            if n < 3:
                return []
            frames = samples[: n * frame].reshape(n, frame)
            rms = np.sqrt(np.mean(frames ** 2, axis=1) + 1e-12)
            # transient boost
            trans = np.zeros_like(rms)
            trans[1:] = np.maximum(0, rms[1:] - rms[:-1])
            if rms.max() > 0:
                rms = rms / rms.max()
            if trans.max() > 0:
                trans = trans / trans.max()
            score = rms + profile.transient_boost * 0.5 * trans
            if score.max() > 0:
                score = score / score.max()

            times = np.arange(n) * window_s
            thresh = np.percentile(score, min(95, max(70, profile.top_percentile)))
            peaks = []
            for i in range(1, n - 1):
                if score[i] >= thresh and score[i] >= score[i - 1] and score[i] >= score[i + 1]:
                    peaks.append((float(times[i]), float(score[i])))
            peaks.sort(key=lambda x: x[1], reverse=True)

            segments: List[HighlightSegment] = []
            used: List[Tuple[float, float]] = []
            ideal = profile.ideal_segment
            for peak_t, sc in peaks:
                pre = ideal * profile.pre_roll
                post = ideal * profile.post_roll
                a = max(0.0, peak_t - pre)
                b = min(meta.duration, peak_t + post)
                if b - a < profile.min_segment:
                    mid = (a + b) / 2
                    a = max(0.0, mid - profile.min_segment / 2)
                    b = min(meta.duration, mid + profile.min_segment / 2)
                if b - a > profile.max_segment:
                    mid = (a + b) / 2
                    a = max(0.0, mid - profile.max_segment / 2)
                    b = min(meta.duration, mid + profile.max_segment / 2)
                if any(not (b < us or a > ue) for us, ue in used):
                    continue
                used.append((a, b))
                segments.append(HighlightSegment(
                    start=round(a, 2), end=round(b, 2), score=round(sc, 3),
                    reason="turbo_audio", game_profile=profile.id,
                ))
                if len(segments) >= top_n:
                    break
            segments.sort(key=lambda s: s.start)
            print(f"   TURBO found {len(segments)} segments")
            return segments
        finally:
            import os
            if os.path.exists(wav_path):
                os.unlink(wav_path)



    def detect_highlights_fast(
        self,
        video_path: str,
        game: str = "generic",
        top_n: int = 8,
        target_duration: float = 28.0,
    ) -> List[HighlightSegment]:
        """
        Fast path for 3–8 hour VODs (< ~15 min wall time goal).
        - One FFmpeg audio extract (mono, low sample rate)
        - Streaming RMS peak detection (no full visual / no YOLO)
        - Returns top_n non-overlapping segments
        """
        import time as _time
        t0 = _time.time()
        profile = get_profile(game)
        meta = self.get_metadata(video_path)
        if not meta.has_audio or meta.duration <= 0:
            print("   Fast path: no audio — cannot detect highlights")
            return []

        sr = 8000  # low rate = fast extract + small RAM
        window_sec = 1.0
        hop_sec = 0.5
        print(f"   Fast path: extracting audio @ {sr} Hz for {meta.duration/3600:.1f}h VOD...")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            wav_path = tmp.name
        try:
            cmd = [
                self.ffmpeg, "-y", "-i", video_path,
                "-vn", "-ac", "1", "-ar", str(sr),
                "-c:a", "pcm_s16le", wav_path,
            ]
            subprocess.run(cmd, capture_output=True, check=True)
            t_extract = _time.time() - t0
            print(f"   Audio extract done in {t_extract:.1f}s")

            # Read as int16, compute RMS per window without loading float64 of entire file if possible
            import wave
            with wave.open(wav_path, "rb") as wf:
                n_channels = wf.getnchannels()
                sampwidth = wf.getsampwidth()
                fr = wf.getframerate()
                n_frames = wf.getnframes()
                raw = wf.readframes(n_frames)

            if sampwidth == 2:
                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
            else:
                samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)

            if n_channels > 1:
                samples = samples.reshape(-1, n_channels).mean(axis=1)

            win = max(1, int(fr * window_sec))
            hop = max(1, int(fr * hop_sec))
            n = (len(samples) - win) // hop + 1
            if n < 3:
                return []

            # Vectorized-ish RMS
            energies = []
            times = []
            for i in range(n):
                start = i * hop
                chunk = samples[start:start + win]
                energies.append(float(np.sqrt(np.mean(chunk * chunk) + 1e-12)))
                times.append(start / float(fr))

            energies = np.array(energies, dtype=np.float64)
            times = np.array(times, dtype=np.float64)
            if energies.max() > 0:
                energies = energies / energies.max()

            # Prefer transients for shooters, sustained for racing — simple delta boost
            delta = np.zeros_like(energies)
            delta[1:] = np.maximum(0.0, energies[1:] - energies[:-1])
            if delta.max() > 0:
                delta = delta / delta.max()

            if profile.id in ("tarkov", "fps", "battle_royale"):
                score = 0.55 * energies + 0.45 * delta
            elif profile.id == "iracing":
                score = 0.7 * energies + 0.3 * delta
            else:
                score = 0.65 * energies + 0.35 * delta

            if score.max() > 0:
                score = score / score.max()

            # Local maxima above percentile
            thresh = np.percentile(score, 85)
            peaks = []
            for i in range(1, len(score) - 1):
                if score[i] >= thresh and score[i] >= score[i - 1] and score[i] >= score[i + 1]:
                    peaks.append((float(times[i]), float(score[i])))
            peaks.sort(key=lambda x: x[1], reverse=True)

            ideal = float(getattr(profile, "ideal_segment", target_duration) or target_duration)
            min_seg = float(getattr(profile, "min_segment", 12.0))
            max_seg = float(getattr(profile, "max_segment", 55.0))
            pre = float(getattr(profile, "pre_roll", 0.35))
            post = float(getattr(profile, "post_roll", 0.65))

            used: List[Tuple[float, float]] = []
            segments: List[HighlightSegment] = []
            for peak_t, sc in peaks:
                length = min(max_seg, max(min_seg, ideal))
                seg_start = max(0.0, peak_t - length * pre)
                seg_end = min(meta.duration, peak_t + length * post)
                if seg_end - seg_start < min_seg:
                    mid = 0.5 * (seg_start + seg_end)
                    seg_start = max(0.0, mid - min_seg / 2)
                    seg_end = min(meta.duration, mid + min_seg / 2)
                if any(not (seg_end < us or seg_start > ue) for us, ue in used):
                    continue
                used.append((seg_start, seg_end))
                segments.append(HighlightSegment(
                    start=round(seg_start, 2),
                    end=round(seg_end, 2),
                    score=round(sc, 3),
                    reason="fast_audio_peak",
                    game_profile=profile.id,
                ))
                if len(segments) >= top_n:
                    break

            segments.sort(key=lambda s: s.start)
            print(f"   Fast path found {len(segments)} segments in {_time.time() - t0:.1f}s total")
            return segments
        finally:
            if os.path.exists(wav_path):
                try:
                    os.unlink(wav_path)
                except Exception:
                    pass

    def suggest_shorts_candidates(
        self,
        video_path: str,
        game: str = "generic",
        target_count: int = 8,
        min_len: Optional[float] = None,
        max_len: Optional[float] = None,
        turbo: bool = False,
    ) -> List[HighlightSegment]:
        import copy
        profile = copy.copy(get_profile(game))
        # Allow override of lengths without mutating the global profile
        if min_len is not None:
            profile.min_segment = min_len
        if max_len is not None:
            profile.max_segment = max_len

        # Auto-turbo for long VODs unless caller forces full mode
        try:
            dur = self.get_metadata(video_path).duration
        except Exception:
            dur = 0
        if turbo or dur >= 1800:  # 30m+ default turbo (aim <15 min total)
            peaks = self.detect_highlights_turbo(
                video_path, game=game, top_n=target_count * 2, custom_profile=profile
            )
        else:
            peaks = self.detect_highlights(video_path, game=game, top_n=target_count * 2, custom_profile=profile)

        # Duration preference scoring
        for seg in peaks:
            ideal = profile.ideal_segment
            dur_penalty = abs(seg.duration - ideal) / max(ideal, 1.0)
            seg.score = max(0.0, seg.score * (1.0 - 0.25 * dur_penalty))

        peaks.sort(key=lambda s: s.score, reverse=True)
        return peaks[:target_count]

    def detect_silence_regions(
        self,
        video_path: str,
        min_silence_len: int = 800,
        silence_thresh: int = -40,
    ) -> List[Tuple[float, float]]:
        meta = self.get_metadata(video_path)
        if not meta.has_audio:
            return []
        try:
            audio = self.extract_audio_segment(video_path)
            nonsilent = detect_nonsilent(audio, min_silence_len=min_silence_len, silence_thresh=silence_thresh)
            return [(s / 1000.0, e / 1000.0) for s, e in nonsilent]
        except Exception:
            return []
