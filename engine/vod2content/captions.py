"""
Professional auto-captions for Shorts — optimized for speed.
Uses faster-whisper when available (int8, tiny/base, beam=1, VAD).
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
from pathlib import Path
from typing import List, Optional, Tuple

# Speed-first defaults (override via env or callers)
DEFAULT_MODEL = os.environ.get("VOD2CONTENT_WHISPER_MODEL", "tiny")  # tiny >> base >> small
DEFAULT_LANGUAGE = os.environ.get("VOD2CONTENT_WHISPER_LANG", "en")


def whisper_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        pass
    try:
        import whisper  # noqa: F401
        return True
    except ImportError:
        return False


def _sec_to_ass(t: float) -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"


def segments_to_ass(
    segments: List[Tuple[float, float, str]],
    style: str = "shorts",
) -> str:
    if style == "shorts":
        style_line = (
            "Style: Default,Arial Black,58,&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,"
            "-1,0,0,0,100,100,0,0,1,5,2,2,48,48,120,1"
        )
    else:
        style_line = (
            "Style: Default,Arial,42,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
            "-1,0,0,0,100,100,0,0,1,3,0.8,2,40,40,60,1"
        )

    header = f"""[Script Info]
Title: VOD2Content Captions
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    for start, end, text in segments:
        text = re.sub(r"\s+", " ", text).strip()
        if not text:
            continue
        words = text.split(" ")
        lines, cur = [], ""
        for w in words:
            trial = (cur + " " + w).strip()
            if len(trial) > 28 and cur:
                lines.append(cur)
                cur = w
            else:
                cur = trial
        if cur:
            lines.append(cur)
        body = r"\N".join(lines[:3])
        events.append(
            f"Dialogue: 0,{_sec_to_ass(start)},{_sec_to_ass(end)},Default,,0,0,0,,{body}"
        )
    return header + "\n".join(events) + "\n"


_model_cache = {}


def _get_faster_whisper(model_size: str):
    """Cache model in-process so 6 Shorts don't reload weights 6 times."""
    global _model_cache
    if model_size in _model_cache:
        return _model_cache[model_size]
    from faster_whisper import WhisperModel
    import torch

    # Prefer CUDA only if it actually runs (RTX 50xx may not with older torch)
    device = "cpu"
    compute = "int8"
    if torch.cuda.is_available():
        try:
            t = torch.zeros(1, device="cuda")
            _ = t + 1
            del t
            torch.cuda.empty_cache()
            device = "cuda"
            compute = "float16"
        except Exception:
            device = "cpu"
            compute = "int8"

    # cpu_threads: use most cores but leave 1–2 free
    n = os.cpu_count() or 4
    cpu_threads = max(2, n - 1)

    print(f"   Whisper model={model_size} device={device} compute={compute} threads={cpu_threads}")
    model = WhisperModel(
        model_size,
        device=device,
        compute_type=compute,
        cpu_threads=cpu_threads,
        num_workers=1,
    )
    _model_cache[model_size] = model
    return model


def transcribe_file(
    media_path: str,
    model_size: str = DEFAULT_MODEL,
    language: Optional[str] = DEFAULT_LANGUAGE,
) -> List[Tuple[float, float, str]]:
    """
    Fast transcription path:
    - faster-whisper + int8/CPU or float16/CUDA
    - beam_size=1, VAD, no condition on previous text
    - language fixed (default en) skips detection
    - model cached across clips in the same process
    """
    try:
        model = _get_faster_whisper(model_size)
        segs, _info = model.transcribe(
            media_path,
            language=language or None,
            task="transcribe",
            beam_size=1,              # greedy-ish — big speed win
            best_of=1,
            patience=1.0,
            vad_filter=True,          # skip silence
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=200,
            ),
            condition_on_previous_text=False,  # speed + less drift
            word_timestamps=False,
            without_timestamps=False,
        )
        out = []
        for s in segs:
            txt = (s.text or "").strip()
            if txt:
                out.append((float(s.start), float(s.end), txt))
        return out
    except Exception as e:
        print(f"   faster-whisper failed ({e}); trying openai-whisper…")

    import whisper
    model = whisper.load_model(model_size)
    result = model.transcribe(
        media_path,
        language=language,
        fp16=False,
        verbose=False,
        condition_on_previous_text=False,
        beam_size=1,
        best_of=1,
    )
    out = []
    for s in result.get("segments") or []:
        txt = (s.get("text") or "").strip()
        if txt:
            out.append((float(s["start"]), float(s["end"]), txt))
    return out


def burn_captions(
    video_in: str,
    video_out: str,
    ass_path: str,
    ffmpeg: str = "ffmpeg",
    quality_args: Optional[List[str]] = None,
) -> str:
    quality_args = quality_args or [
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        "-c:a", "aac", "-b:a", "128k",
    ]
    sub = ass_path.replace("\\", "/").replace(":", r"\:")
    vf = f"subtitles='{sub}'"
    cmd = [ffmpeg, "-y", "-i", video_in, "-vf", vf, *quality_args, "-movflags", "+faststart", video_out]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr[-800:] if proc.stderr else "subtitle burn failed")
    return video_out


def caption_clip(
    source_video: str,
    start: float,
    end: float,
    work_dir: str,
    ffmpeg: str = "ffmpeg",
    model_size: str = DEFAULT_MODEL,
    language: Optional[str] = DEFAULT_LANGUAGE,
) -> Optional[str]:
    """
    Transcribe only [start, end] — never the full VOD.
    16 kHz mono wav keeps decode cheap.
    """
    if not whisper_available():
        return None

    Path(work_dir).mkdir(parents=True, exist_ok=True)
    wav = os.path.join(work_dir, "cap.wav")
    ass = os.path.join(work_dir, "cap.ass")
    dur = max(0.1, end - start)

    # Fast extract: seek + short decode only
    subprocess.run(
        [
            ffmpeg, "-y",
            "-ss", f"{start:.3f}",
            "-t", f"{dur:.3f}",
            "-i", source_video,
            "-vn", "-ac", "1", "-ar", "16000",
            "-c:a", "pcm_s16le",
            wav,
        ],
        capture_output=True,
        check=True,
    )
    segs = transcribe_file(wav, model_size=model_size, language=language)
    if not segs:
        return None
    Path(ass).write_text(segments_to_ass(segs, style="shorts"), encoding="utf-8")
    return ass
