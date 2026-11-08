"""Simple progress + ETA helpers for CLI and GUI."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class ProgressState:
    fraction: float = 0.0  # 0..1
    message: str = ""
    eta_sec: Optional[float] = None
    stage: str = ""
    detail: str = ""


class ProgressTracker:
    def __init__(self, callback: Optional[Callable[[ProgressState], None]] = None):
        self.callback = callback
        self.t0 = time.time()
        self.state = ProgressState()

    def update(
        self,
        fraction: float,
        message: str = "",
        stage: str = "",
        detail: str = "",
        eta_sec: Optional[float] = None,
    ) -> None:
        fraction = max(0.0, min(1.0, float(fraction)))
        if eta_sec is None and fraction > 0.05:
            elapsed = time.time() - self.t0
            eta_sec = max(0.0, elapsed * (1.0 / fraction - 1.0))
        self.state = ProgressState(
            fraction=fraction,
            message=message or self.state.message,
            eta_sec=eta_sec,
            stage=stage or self.state.stage,
            detail=detail,
        )
        if self.callback:
            self.callback(self.state)

    def format_eta(self) -> str:
        e = self.state.eta_sec
        if e is None:
            return "…"
        if e < 60:
            return f"~{int(e)}s left"
        if e < 3600:
            return f"~{int(e // 60)}m {int(e % 60)}s left"
        return f"~{e/3600:.1f}h left"


def estimate_job_seconds(
    duration_sec: float,
    mode: str,
    count: int = 6,
    quality: str = "medium",
    captions: bool = True,
) -> float:
    """
    Rough wall-time estimate for planning the progress bar.
    Tuned for typical PC + TURBO path; not a guarantee.
    """
    hours = duration_sec / 3600.0
    q_mult = {"draft": 0.7, "medium": 1.0, "high": 1.4}.get(quality, 1.0)

    if mode.startswith("Fast") or mode == "clip":
        # seek + encode one segment
        base = 25 + min(duration_sec * 0.002, 40)  # longer files slightly slower seek
        if captions:
            base += 40  # whisper on one clip
        return base * q_mult

    if mode.startswith("Analyze"):
        if duration_sec >= 1800:
            return 60 + hours * 90  # turbo audio
        return 40 + hours * 180

    if mode.startswith("Long"):
        detect = 60 + hours * 90 if duration_sec >= 1800 else 40 + hours * 150
        encode = count * 35 * q_mult
        return detect + encode

    # Shorts
    if duration_sec >= 1800:
        detect = 50 + hours * 80  # turbo
    else:
        detect = 30 + hours * 200
    encode = count * (28 if quality == "draft" else 40 if quality == "medium" else 55)
    if captions:
        encode += count * 35
    return (detect + encode) * (1.0 if duration_sec >= 1800 else 1.0)
