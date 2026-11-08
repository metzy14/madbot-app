"""
Optional YouTube / URL download via yt-dlp.
Used when the user pastes a video or channel URL instead of a local path.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


def ytdlp_available() -> bool:
    if shutil.which("yt-dlp"):
        return True
    try:
        import yt_dlp  # noqa: F401
        return True
    except ImportError:
        return False


def _run_ytdlp(args: List[str]) -> subprocess.CompletedProcess:
    if shutil.which("yt-dlp"):
        return subprocess.run(["yt-dlp", *args], capture_output=True, text=True)
    # module form
    return subprocess.run(
        ["python", "-m", "yt_dlp", *args],
        capture_output=True,
        text=True,
    )


def list_channel_videos(url: str, limit: int = 5) -> List[Dict[str, Any]]:
    """Return recent entries from a channel/playlist/video URL (metadata only)."""
    args = [
        "--flat-playlist",
        "--dump-json",
        "--playlist-end", str(limit),
        "--no-download",
        url,
    ]
    proc = _run_ytdlp(args)
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "yt-dlp failed")
    items = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            items.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return items


def download_video(
    url: str,
    output_dir: str,
    max_height: int = 1080,
    filename_template: str = "%(title).80s [%(id)s].%(ext)s",
) -> str:
    """
    Download a single video (or first/latest from a channel URL).
    Returns path to the downloaded file.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    outtmpl = str(out / filename_template)

    # Prefer mp4 under max_height for editing compatibility
    fmt = f"bv*[height<={max_height}][ext=mp4]+ba[ext=m4a]/b[height<={max_height}][ext=mp4]/bv*[height<={max_height}]+ba/b"
    args = [
        "-f", fmt,
        "--merge-output-format", "mp4",
        "-o", outtmpl,
        "--no-playlist",  # single video when URL is a watch link
        "--print", "after_move:filepath",
        "--no-mtime",
        url,
    ]
    proc = _run_ytdlp(args)
    if proc.returncode != 0:
        # Retry allowing playlist entry (channel → latest)
        args = [
            "-f", fmt,
            "--merge-output-format", "mp4",
            "-o", outtmpl,
            "--playlist-end", "1",
            "--print", "after_move:filepath",
            "--no-mtime",
            url,
        ]
        proc = _run_ytdlp(args)
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip() or proc.stdout.strip() or "Download failed")

    # Parse printed path(s)
    paths = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip() and not ln.startswith("[")]
    # Also search output dir for newest mp4
    if paths:
        candidate = Path(paths[-1])
        if candidate.exists():
            return str(candidate)

    mp4s = sorted(out.glob("*.mp4"), key=lambda p: p.stat().st_mtime, reverse=True)
    if mp4s:
        return str(mp4s[0])
    raise RuntimeError("Download finished but no file was found")
