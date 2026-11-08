"""
Pro finish pass — the last mile that makes a clip feel published, not dumped.
Applies after cut/encode: loudness already done in editor; this documents the bar.
"""

from __future__ import annotations

# Product standard for every Short leaving the pipeline
SHORTS_SPEC = {
    "width": 1080,
    "height": 1920,
    "aspect": "9:16",
    "max_duration_sec": 59,
    "target_lufs": -14,
    "captions": "burned-in, high contrast, bottom-safe",
    "audio": "speech-first, limited peaks",
    "export": "H.264 + AAC, faststart",
}

HOOK_LINES = {
    "iracing": ["Wait for the contact", "This overtake was illegal", "Listen to the tire"],
    "tarkov": ["One mag left", "He didn't hear me", "Extract is 40m"],
    "fps": ["Clutch. No ammo.", "They peeked together", "One bullet."],
    "generic": ["Don't scroll past this", "The part nobody clips", "Watch the end"],
}
