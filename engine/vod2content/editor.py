"""
Video editing engine powered by FFmpeg.
Handles cropping to vertical, trimming, speed ramps, text overlays,
captions, zooms, and multi-format export for Shorts / long-form / Reels.
"""

import os
import subprocess
import tempfile
import shutil
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from dataclasses import dataclass

from .analyzer import VideoMetadata, HighlightSegment, VideoAnalyzer


@dataclass
class EditJob:
    source: str
    output: str
    start: float
    end: float
    target_aspect: str = "9:16"  # "9:16", "16:9", "1:1"
    add_captions: bool = False
    caption_file: Optional[str] = None
    text_overlay: Optional[str] = None
    zoom_effect: bool = False
    speed: float = 1.0
    quality: str = "high"  # high, medium, draft
    platform: str = "youtube_shorts"


class VideoEditor:
    def __init__(self, ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe"):
        self.ffmpeg = ffmpeg
        self.ffprobe = ffprobe
        self.analyzer = VideoAnalyzer(ffmpeg, ffprobe)

    def _run(self, cmd: List[str], check: bool = True) -> subprocess.CompletedProcess:
        return subprocess.run(cmd, capture_output=True, text=True, check=check)

    def _quality_args(self, quality: str) -> List[str]:
        if quality == "high":
            return ["-c:v", "libx264", "-preset", "fast", "-crf", "20", "-c:a", "aac", "-b:a", "160k"]
        elif quality == "medium":
            return ["-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac", "-b:a", "128k"]
        else:  # draft — prioritize speed for <15 min jobs
            return ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "26", "-c:a", "aac", "-b:a", "96k", "-threads", "0"]

    def _build_crop_filter(self, meta: VideoMetadata, target_aspect: str) -> str:
        """Smart center-crop (or letterbox) to target aspect ratio."""
        src_ar = meta.aspect_ratio
        if target_aspect == "9:16":
            tgt_ar = 9 / 16
        elif target_aspect == "1:1":
            tgt_ar = 1.0
        else:
            tgt_ar = 16 / 9

        if abs(src_ar - tgt_ar) < 0.02:
            return "null"

        # Center crop
        if src_ar > tgt_ar:
            # Source wider → crop width
            new_w = int(meta.height * tgt_ar)
            new_w = new_w - (new_w % 2)
            x = (meta.width - new_w) // 2
            return f"crop={new_w}:{meta.height}:{x}:0"
        else:
            # Source taller → crop height
            new_h = int(meta.width / tgt_ar)
            new_h = new_h - (new_h % 2)
            y = (meta.height - new_h) // 2
            return f"crop={meta.width}:{new_h}:0:{y}"

    def create_short(
        self,
        source: str,
        output: str,
        start: float,
        end: float,
        target_aspect: str = "9:16",
        text_overlay: Optional[str] = None,
        zoom: bool = True,
        quality: str = "high",
        burn_captions: Optional[str] = None,
        auto_captions: bool = False,
        caption_language: Optional[str] = None,
    ) -> str:
        """
        Create a vertical Short from a time range.
        Applies smart crop, optional Ken-Burns zoom, text, and captions.
        """
        meta = self.analyzer.get_metadata(source)
        duration = end - start
        if duration <= 0:
            raise ValueError("Invalid segment duration")

        filters = []

        # 1. Trim is handled by -ss/-to for speed
        # 2. Crop / scale
        crop = self._build_crop_filter(meta, target_aspect)
        if crop != "null":
            filters.append(crop)

        # Scale to standard Shorts resolution (1080x1920) while preserving quality
        if target_aspect == "9:16":
            filters.append("scale=1080:1920:force_original_aspect_ratio=decrease")
            filters.append("pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black")
        elif target_aspect == "1:1":
            filters.append("scale=1080:1080:force_original_aspect_ratio=decrease")
            filters.append("pad=1080:1080:(ow-iw)/2:(oh-ih)/2:black")

        # Optional subtle zoom / Ken Burns for engagement
        if zoom and duration > 5:
            # Slow zoom in over the clip
            filters.append(
                f"zoompan=z='min(zoom+0.0008,1.15)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920"
            )

        # Text overlay (hook / title)
        if text_overlay:
            # Escape special chars for drawtext
            safe_text = text_overlay.replace("'", r"\'").replace(":", r"\:")
            # Big bold text at top third – classic Shorts hook style
            filters.append(
                f"drawtext=text='{safe_text}':fontsize=48:fontcolor=white:borderw=3:bordercolor=black:"
                f"x=(w-text_w)/2:y=h*0.12:enable='between(t,0,4)'"
            )

        # Burn captions if provided (SRT)
        if burn_captions and os.path.exists(burn_captions):
            # Assumed SRT; convert path for filter
            safe_cap = burn_captions.replace("\\", "/").replace(":", r"\:")
            filters.append(f"subtitles='{safe_cap}':force_style='Fontsize=28,PrimaryColour=&H00FFFFFF,Outline=2'")

        vf = ",".join(filters) if filters else "null"

        cmd = [
            self.ffmpeg, "-y",
            "-ss", f"{start:.3f}",
            "-to", f"{end:.3f}",
            "-i", source,
            "-vf", vf,
            "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",  # YouTube/TikTok loudness standard
        ] + self._quality_args(quality) + [
            "-movflags", "+faststart",
            output
        ]

        self._run(cmd)

        if auto_captions:
            try:
                from .captions import whisper_available, caption_clip, burn_captions
                if whisper_available():
                    import tempfile
                    with tempfile.TemporaryDirectory() as td:
                        ass = caption_clip(
                            source, start, end, td,
                            ffmpeg=self.ffmpeg,
                            language=caption_language,
                        )
                        if ass:
                            tmp_out = output + ".cap.mp4"
                            burn_captions(
                                output, tmp_out, ass, ffmpeg=self.ffmpeg,
                                quality_args=self._quality_args(quality),
                            )
                            import shutil
                            shutil.move(tmp_out, output)
                            print("   字幕 Captions burned in")
                else:
                    print("   (Captions skipped — install faster-whisper for auto-subs)")
            except Exception as e:
                print(f"   Captions failed: {e}")

        return output

    def create_longform_highlight_reel(
        self,
        source: str,
        output: str,
        segments: List[HighlightSegment],
        intro_path: Optional[str] = None,
        outro_path: Optional[str] = None,
        quality: str = "high",
        target_aspect: str = "16:9",
    ) -> str:
        """
        Stitch multiple highlight segments into a polished long-form video.
        Adds optional intro/outro and smooth transitions.
        """
        if not segments:
            raise ValueError("No segments provided")

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            part_files = []

            # Optional intro
            if intro_path and os.path.exists(intro_path):
                intro_out = tmp / "intro.mp4"
                self._run([
                    self.ffmpeg, "-y", "-i", intro_path,
                    "-c:v", "libx264", "-c:a", "aac", "-t", "8",
                    str(intro_out)
                ])
                part_files.append(str(intro_out))

            # Extract and process each segment
            for i, seg in enumerate(segments):
                part = tmp / f"part_{i:03d}.mp4"
                meta = self.analyzer.get_metadata(source)
                crop = self._build_crop_filter(meta, target_aspect)
                vf = crop if crop != "null" else "null"
                if target_aspect == "16:9":
                    vf = f"{vf},scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2"

                cmd = [
                    self.ffmpeg, "-y",
                    "-ss", f"{seg.start:.3f}", "-to", f"{seg.end:.3f}",
                    "-i", source,
                    "-vf", vf,
                    "-af", "loudnorm=I=-14:TP=-1.5:LRA=11",
                ] + self._quality_args(quality) + [str(part)]
                self._run(cmd)
                part_files.append(str(part))

            # Optional outro
            if outro_path and os.path.exists(outro_path):
                outro_out = tmp / "outro.mp4"
                self._run([
                    self.ffmpeg, "-y", "-i", outro_path,
                    "-c:v", "libx264", "-c:a", "aac", "-t", "10",
                    str(outro_out)
                ])
                part_files.append(str(outro_out))

            # Concat via demuxer
            list_file = tmp / "concat.txt"
            with open(list_file, "w") as f:
                for p in part_files:
                    f.write(f"file '{p}'\n")

            cmd = [
                self.ffmpeg, "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_file),
                "-c", "copy",  # already encoded
                output
            ]
            self._run(cmd)

        return output

    def generate_thumbnail(
        self,
        source: str,
        output: str,
        timestamp: float,
        text: Optional[str] = None,
        style: str = "youtube",
    ) -> str:
        """Extract frame + optional bold text overlay for click-worthy thumbnail."""
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            frame_path = tmp.name

        try:
            # Extract single frame
            self._run([
                self.ffmpeg, "-y", "-ss", f"{timestamp:.3f}",
                "-i", source, "-frames:v", "1", "-q:v", "2", frame_path
            ])

            if text:
                from PIL import Image, ImageDraw, ImageFont
                img = Image.open(frame_path).convert("RGB")
                draw = ImageDraw.Draw(img)
                # Try to load a bold font; fallback to default
                try:
                    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
                except Exception:
                    font = ImageFont.load_default()

                # Shadow + main text
                w, h = img.size
                # Simple centered text with outline
                bbox = draw.textbbox((0, 0), text, font=font)
                tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
                x = (w - tw) // 2
                y = int(h * 0.7)

                for dx, dy in [(-3, -3), (-3, 3), (3, -3), (3, 3), (0, 0)]:
                    color = (0, 0, 0) if (dx, dy) != (0, 0) else (255, 255, 0)
                    draw.text((x + dx, y + dy), text, font=font, fill=color)

                img.save(output, quality=95)
            else:
                shutil.copy(frame_path, output)
        finally:
            if os.path.exists(frame_path):
                os.unlink(frame_path)

        return output

    def remove_silence(
        self,
        source: str,
        output: str,
        min_silence_len: int = 600,
        silence_thresh: int = -38,
        padding_ms: int = 150,
        quality: str = "medium",
    ) -> str:
        """Jump-cut silence for tighter pacing (great for long-form algorithm retention)."""
        nonsilent = self.analyzer.detect_silence_regions(source, min_silence_len, silence_thresh)
        if not nonsilent:
            shutil.copy(source, output)
            return output

        # Build filter_complex for selective keep
        # Simpler approach: extract segments and concat
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            parts = []
            for i, (s, e) in enumerate(nonsilent):
                # Add small padding
                s = max(0, s - padding_ms / 1000)
                part = tmp / f"ns_{i}.mp4"
                self._run([
                    self.ffmpeg, "-y", "-ss", f"{s:.3f}", "-to", f"{e:.3f}",
                    "-i", source, "-c", "copy", str(part)
                ])
                parts.append(str(part))

            list_file = tmp / "list.txt"
            with open(list_file, "w") as f:
                for p in parts:
                    f.write(f"file '{p}'\n")

            self._run([
                self.ffmpeg, "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_file), "-c", "copy", output
            ])
        return output

    def clip_last_seconds(
        self,
        source: str,
        output: str,
        seconds: float = 60.0,
        target_aspect: str = "9:16",
        quality: str = "medium",
        text_overlay: Optional[str] = None,
    ) -> str:
        """
        Efficiently cut the last `seconds` of a VOD.
        Uses FFmpeg input seeking near the end — no full-file analysis.
        """
        meta = self.analyzer.get_metadata(source)
        if meta.duration <= 0:
            raise ValueError("Could not read video duration")
        seconds = max(1.0, float(seconds))
        start = max(0.0, meta.duration - seconds)
        end = meta.duration
        print(f"   Clip last {seconds:.0f}s → {start:.1f}s to {end:.1f}s (of {meta.duration:.1f}s)")
        return self.create_short(
            source=source,
            output=output,
            start=start,
            end=end,
            target_aspect=target_aspect,
            text_overlay=text_overlay,
            zoom=False,  # speed
            quality=quality,
        )

