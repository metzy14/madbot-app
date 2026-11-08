#!/usr/bin/env python3
"""
VOD2Content — native desktop GUI (tkinter).
No browser. Fully self-contained window.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import traceback
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

from vod2content.analyzer import VideoAnalyzer
from vod2content.game_profiles import get_profile, list_profiles
from vod2content.downloader import ytdlp_available, download_video
from vod2content.progress import estimate_job_seconds


# ── theme ──────────────────────────────────────────────────────────
BG = "#0b0d12"
SURFACE = "#12151c"
SURFACE2 = "#1a1e28"
BORDER = "#2a3140"
TEXT = "#e8eaef"
MUTED = "#9aa3b5"
ACCENT = "#6c8cff"
ACCENT2 = "#8b5cf6"
SUCCESS = "#34d399"
WARN = "#fbbf24"
DANGER = "#f87171"


def _default_out() -> str:
    home = Path.home()
    for c in (home / "Videos" / "VOD2Content", home / "VOD2Content_Output"):
        try:
            c.mkdir(parents=True, exist_ok=True)
            return str(c)
        except Exception:
            continue
    return str(home / "VOD2Content_Output")


def _download_dir() -> Path:
    p = Path.home() / ".vod2content" / "downloads"
    p.mkdir(parents=True, exist_ok=True)
    return p


class VOD2ContentApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("VOD2Content")
        self.geometry("980x720")
        self.minsize(860, 640)
        self.configure(bg=BG)

        self.video_path: Optional[str] = None
        self.tmp_path: Optional[str] = None
        self.display_name: Optional[str] = None
        self.meta = None
        self._worker: Optional[threading.Thread] = None
        self._busy = False

        self._build_styles()
        self._build_ui()
        self.protocol("WM_DELETE_WINDOW", self._on_close)

    # ── styles ────────────────────────────────────────────────────
    def _build_styles(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except Exception:
            pass
        style.configure(".", background=BG, foreground=TEXT, fieldbackground=SURFACE2)
        style.configure("TFrame", background=BG)
        style.configure("Card.TFrame", background=SURFACE)
        style.configure("TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("Muted.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("Card.TLabel", background=SURFACE, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("CardMuted.TLabel", background=SURFACE, foreground=MUTED, font=("Segoe UI", 9))
        style.configure("Title.TLabel", background=BG, foreground=TEXT, font=("Segoe UI", 18, "bold"))
        style.configure("Sub.TLabel", background=BG, foreground=MUTED, font=("Segoe UI", 10))
        style.configure("Header.TLabel", background=SURFACE, foreground=MUTED,
                        font=("Segoe UI", 9, "bold"))
        style.configure("TButton", font=("Segoe UI", 10), padding=8)
        style.configure("Accent.TButton", font=("Segoe UI", 11, "bold"), padding=(16, 10))
        style.configure("TEntry", fieldbackground=SURFACE2, foreground=TEXT)
        style.configure("TCombobox", fieldbackground=SURFACE2, foreground=TEXT)
        style.configure("TRadiobutton", background=SURFACE, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("TCheckbutton", background=SURFACE, foreground=TEXT, font=("Segoe UI", 10))
        style.configure("TLabelframe", background=SURFACE, foreground=MUTED)
        style.configure("TLabelframe.Label", background=SURFACE, foreground=MUTED,
                        font=("Segoe UI", 9, "bold"))
        style.configure("Horizontal.TProgressbar", troughcolor=SURFACE2, background=ACCENT,
                        thickness=18)

    # ── layout ────────────────────────────────────────────────────
    def _build_ui(self):
        outer = ttk.Frame(self, style="TFrame")
        outer.pack(fill=tk.BOTH, expand=True, padx=18, pady=14)

        # Hero
        hero = tk.Frame(outer, bg=SURFACE, highlightbackground=BORDER, highlightthickness=1)
        hero.pack(fill=tk.X, pady=(0, 14))
        hero_inner = tk.Frame(hero, bg=SURFACE)
        hero_inner.pack(fill=tk.X, padx=16, pady=14)
        tk.Label(hero_inner, text="VOD2Content", bg=SURFACE, fg=TEXT,
                 font=("Segoe UI", 20, "bold")).pack(anchor=tk.W)
        tk.Label(
            hero_inner,
            text="Long streams → Shorts, clips & highlight reels  ·  Native app  ·  No browser",
            bg=SURFACE, fg=MUTED, font=("Segoe UI", 10),
        ).pack(anchor=tk.W, pady=(4, 0))

        body = ttk.Frame(outer)
        body.pack(fill=tk.BOTH, expand=True)

        # Left column — settings
        left = tk.Frame(body, bg=SURFACE, highlightbackground=BORDER, highlightthickness=1)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 12))
        left_inner = tk.Frame(left, bg=SURFACE)
        left_inner.pack(fill=tk.BOTH, padx=14, pady=14)

        tk.Label(left_inner, text="WORKSPACE", bg=SURFACE, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)

        profiles = list_profiles()
        self.profile_ids = [p["id"] for p in profiles]
        self.profile_names = {p["id"]: p["name"] for p in profiles}
        self.profile_desc = {p["id"]: p["description"] for p in profiles}

        tk.Label(left_inner, text="Game profile", bg=SURFACE, fg=TEXT).pack(anchor=tk.W, pady=(10, 2))
        self.game_var = tk.StringVar(value="iracing" if "iracing" in self.profile_ids else self.profile_ids[0])
        game_combo = ttk.Combobox(
            left_inner, textvariable=self.game_var, state="readonly", width=28,
            values=[f"{self.profile_names[i]} ({i})" for i in self.profile_ids],
        )
        # store display mapping
        self._game_display = {f"{self.profile_names[i]} ({i})": i for i in self.profile_ids}
        game_combo.set(f"{self.profile_names[self.game_var.get()]} ({self.game_var.get()})")
        game_combo.pack(anchor=tk.W, fill=tk.X)
        self.game_combo = game_combo
        self.game_desc_lbl = tk.Label(left_inner, text=self.profile_desc.get(self.game_var.get(), ""),
                                      bg=SURFACE, fg=MUTED, font=("Segoe UI", 8), wraplength=220, justify=tk.LEFT)
        self.game_desc_lbl.pack(anchor=tk.W, pady=(4, 0))
        game_combo.bind("<<ComboboxSelected>>", self._on_game_change)

        tk.Label(left_inner, text="JOB TYPE", bg=SURFACE, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor=tk.W, pady=(16, 6))
        self.mode_var = tk.StringVar(value="Shorts (auto highlights)")
        for m in [
            "Shorts (auto highlights)",
            "Fast clip — last N seconds",
            "Long-form highlight reel",
            "Analyze only",
        ]:
            tk.Radiobutton(
                left_inner, text=m, variable=self.mode_var, value=m,
                bg=SURFACE, fg=TEXT, selectcolor=SURFACE2, activebackground=SURFACE,
                activeforeground=TEXT, font=("Segoe UI", 9), anchor=tk.W,
                command=self._on_mode_change,
            ).pack(anchor=tk.W, fill=tk.X)

        self.last_secs_frame = tk.Frame(left_inner, bg=SURFACE)
        tk.Label(self.last_secs_frame, text="Seconds from end", bg=SURFACE, fg=TEXT).pack(anchor=tk.W)
        self.last_secs_var = tk.IntVar(value=60)
        tk.Spinbox(self.last_secs_frame, from_=5, to=600, textvariable=self.last_secs_var,
                   width=8, bg=SURFACE2, fg=TEXT, buttonbackground=SURFACE2).pack(anchor=tk.W, pady=4)

        tk.Label(left_inner, text="Shorts / segments", bg=SURFACE, fg=TEXT).pack(anchor=tk.W, pady=(12, 2))
        self.count_var = tk.IntVar(value=6)
        tk.Spinbox(left_inner, from_=2, to=16, textvariable=self.count_var, width=8,
                   bg=SURFACE2, fg=TEXT, buttonbackground=SURFACE2).pack(anchor=tk.W)

        tk.Label(left_inner, text="Quality", bg=SURFACE, fg=TEXT).pack(anchor=tk.W, pady=(12, 2))
        self.quality_var = tk.StringVar(value="medium")
        ttk.Combobox(left_inner, textvariable=self.quality_var, state="readonly", width=12,
                     values=["draft", "medium", "high"]).pack(anchor=tk.W)

        self.captions_var = tk.BooleanVar(value=True)
        tk.Checkbutton(
            left_inner, text="Auto-captions (Whisper)", variable=self.captions_var,
            bg=SURFACE, fg=TEXT, selectcolor=SURFACE2, activebackground=SURFACE,
            activeforeground=TEXT, font=("Segoe UI", 9),
        ).pack(anchor=tk.W, pady=(12, 2))

        tk.Label(left_inner, text="Caption model", bg=SURFACE, fg=TEXT).pack(anchor=tk.W, pady=(4, 2))
        self.caption_model_var = tk.StringVar(value="tiny")
        ttk.Combobox(left_inner, textvariable=self.caption_model_var, state="readonly", width=12,
                     values=["tiny", "base", "small"]).pack(anchor=tk.W)

        tk.Label(left_inner, text="Topic / keywords", bg=SURFACE, fg=TEXT).pack(anchor=tk.W, pady=(12, 2))
        self.topic_var = tk.StringVar(value=get_profile(self.game_var.get()).default_topic)
        tk.Entry(left_inner, textvariable=self.topic_var, bg=SURFACE2, fg=TEXT,
                 insertbackground=TEXT, width=28).pack(anchor=tk.W, fill=tk.X)

        tips = tk.Label(
            left_inner,
            text="Tips\n• Path for multi-GB VODs\n• TURBO on long streams\n• Fast clip = quickest",
            bg=SURFACE, fg=MUTED, font=("Segoe UI", 8), justify=tk.LEFT,
        )
        tips.pack(anchor=tk.W, pady=(18, 0))

        # Right column — source / preview / run
        right = tk.Frame(body, bg=BG)
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Source card
        src = tk.Frame(right, bg=SURFACE, highlightbackground=BORDER, highlightthickness=1)
        src.pack(fill=tk.X, pady=(0, 10))
        si = tk.Frame(src, bg=SURFACE)
        si.pack(fill=tk.X, padx=14, pady=12)
        tk.Label(si, text="1  SOURCE", bg=SURFACE, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)

        self.source_mode = tk.StringVar(value="path")
        smf = tk.Frame(si, bg=SURFACE)
        smf.pack(anchor=tk.W, pady=6)
        for val, label in [("path", "Local file path"), ("youtube", "YouTube URL"), ("upload", "Browse file…")]:
            tk.Radiobutton(
                smf, text=label, variable=self.source_mode, value=val,
                bg=SURFACE, fg=TEXT, selectcolor=SURFACE2, activebackground=SURFACE,
                font=("Segoe UI", 9), command=self._on_source_mode,
            ).pack(side=tk.LEFT, padx=(0, 12))

        row = tk.Frame(si, bg=SURFACE)
        row.pack(fill=tk.X, pady=4)
        self.path_var = tk.StringVar()
        self.path_entry = tk.Entry(row, textvariable=self.path_var, bg=SURFACE2, fg=TEXT,
                                   insertbackground=TEXT)
        self.path_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)
        self.browse_btn = tk.Button(
            row, text="Browse", command=self._browse_file,
            bg=SURFACE2, fg=TEXT, relief=tk.FLAT, padx=12, pady=4, font=("Segoe UI", 9),
        )
        self.browse_btn.pack(side=tk.LEFT, padx=(8, 0))
        self.yt_btn = tk.Button(
            row, text="Download", command=self._download_youtube,
            bg=ACCENT, fg="white", relief=tk.FLAT, padx=12, pady=4, font=("Segoe UI", 9, "bold"),
        )
        # yt button shown only in youtube mode

        self.source_status = tk.Label(si, text="Paste a path or browse for a video.",
                                      bg=SURFACE, fg=MUTED, font=("Segoe UI", 9), anchor=tk.W)
        self.source_status.pack(fill=tk.X, pady=(6, 0))
        self.path_var.trace_add("write", lambda *_: self._try_load_path())

        # Preview card
        prev = tk.Frame(right, bg=SURFACE, highlightbackground=BORDER, highlightthickness=1)
        prev.pack(fill=tk.X, pady=(0, 10))
        pi = tk.Frame(prev, bg=SURFACE)
        pi.pack(fill=tk.X, padx=14, pady=12)
        tk.Label(pi, text="2  PREVIEW", bg=SURFACE, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)

        metrics = tk.Frame(pi, bg=SURFACE)
        metrics.pack(fill=tk.X, pady=8)
        self.metric_labels = {}
        for key in ("Duration", "Resolution", "FPS", "Audio"):
            cell = tk.Frame(metrics, bg=SURFACE2, highlightbackground=BORDER, highlightthickness=1)
            cell.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 6))
            tk.Label(cell, text=key, bg=SURFACE2, fg=MUTED, font=("Segoe UI", 8)).pack(anchor=tk.W, padx=8, pady=(6, 0))
            lbl = tk.Label(cell, text="—", bg=SURFACE2, fg=TEXT, font=("Consolas", 11, "bold"))
            lbl.pack(anchor=tk.W, padx=8, pady=(0, 6))
            self.metric_labels[key] = lbl

        self.eta_label = tk.Label(pi, text="Estimated time: —", bg=SURFACE, fg=MUTED,
                                  font=("Segoe UI", 9), anchor=tk.W)
        self.eta_label.pack(fill=tk.X)
        self.preview_note = tk.Label(pi, text="", bg=SURFACE, fg=WARN, font=("Segoe UI", 9),
                                     anchor=tk.W, wraplength=520, justify=tk.LEFT)
        self.preview_note.pack(fill=tk.X, pady=(4, 0))

        # Run card
        run = tk.Frame(right, bg=SURFACE, highlightbackground=BORDER, highlightthickness=1)
        run.pack(fill=tk.BOTH, expand=True)
        ri = tk.Frame(run, bg=SURFACE)
        ri.pack(fill=tk.BOTH, expand=True, padx=14, pady=12)
        tk.Label(ri, text="3  RUN", bg=SURFACE, fg=MUTED,
                 font=("Segoe UI", 8, "bold")).pack(anchor=tk.W)

        out_row = tk.Frame(ri, bg=SURFACE)
        out_row.pack(fill=tk.X, pady=6)
        tk.Label(out_row, text="Output folder", bg=SURFACE, fg=TEXT).pack(side=tk.LEFT)
        self.out_var = tk.StringVar(value=_default_out())
        tk.Entry(out_row, textvariable=self.out_var, bg=SURFACE2, fg=TEXT,
                 insertbackground=TEXT).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8, ipady=3)
        tk.Button(out_row, text="…", command=self._browse_out, bg=SURFACE2, fg=TEXT,
                  relief=tk.FLAT, padx=8).pack(side=tk.LEFT)

        self.start_btn = tk.Button(
            ri, text="Start processing", command=self._start,
            bg=ACCENT, fg="white", relief=tk.FLAT, font=("Segoe UI", 11, "bold"),
            padx=20, pady=10, cursor="hand2",
        )
        self.start_btn.pack(fill=tk.X, pady=(8, 10))

        self.progress_var = tk.DoubleVar(value=0)
        self.progress = ttk.Progressbar(ri, variable=self.progress_var, maximum=100,
                                        style="Horizontal.TProgressbar")
        self.progress.pack(fill=tk.X)

        self.progress_text = tk.Label(ri, text="Ready", bg=SURFACE, fg=MUTED,
                                      font=("Segoe UI", 9), anchor=tk.W)
        self.progress_text.pack(fill=tk.X, pady=(6, 4))

        self.log_box = tk.Text(ri, height=8, bg=SURFACE2, fg=TEXT, insertbackground=TEXT,
                               relief=tk.FLAT, font=("Consolas", 9), wrap=tk.WORD)
        self.log_box.pack(fill=tk.BOTH, expand=True, pady=(4, 0))
        self.log_box.insert("end", "Load a video, choose a job, then Start.\n")
        self.log_box.configure(state=tk.DISABLED)

        self._on_source_mode()
        self._on_mode_change()

    # ── helpers ───────────────────────────────────────────────────
    def _selected_game(self) -> str:
        disp = self.game_combo.get()
        return self._game_display.get(disp, self.game_var.get())

    def _on_game_change(self, *_):
        gid = self._selected_game()
        self.game_var.set(gid)
        self.game_desc_lbl.config(text=self.profile_desc.get(gid, ""))
        try:
            self.topic_var.set(get_profile(gid).default_topic)
        except Exception:
            pass
        self._update_eta()

    def _on_mode_change(self):
        if self.mode_var.get().startswith("Fast clip"):
            self.last_secs_frame.pack(anchor=tk.W, pady=(8, 0))
        else:
            self.last_secs_frame.pack_forget()
        self._update_eta()

    def _on_source_mode(self):
        mode = self.source_mode.get()
        if mode == "youtube":
            self.browse_btn.pack_forget()
            self.yt_btn.pack(side=tk.LEFT, padx=(8, 0))
            self.path_entry.delete(0, tk.END)
            self.source_status.config(text="Paste a YouTube video or channel URL, then Download.", fg=MUTED)
        elif mode == "upload":
            self.yt_btn.pack_forget()
            self.browse_btn.pack(side=tk.LEFT, padx=(8, 0))
            self.source_status.config(text="Browse for a video file on this PC.", fg=MUTED)
        else:
            self.yt_btn.pack_forget()
            self.browse_btn.pack(side=tk.LEFT, padx=(8, 0))
            self.source_status.config(text="Paste the full path to a VOD (best for multi-GB files).", fg=MUTED)

    def _log(self, msg: str):
        self.log_box.configure(state=tk.NORMAL)
        self.log_box.insert("end", msg + "\n")
        self.log_box.see("end")
        self.log_box.configure(state=tk.DISABLED)

    def _set_progress(self, pct: float, text: str):
        self.progress_var.set(max(0, min(100, pct)))
        self.progress_text.config(text=text)

    def _browse_file(self):
        path = filedialog.askopenfilename(
            title="Select video",
            filetypes=[
                ("Video", "*.mp4 *.mkv *.mov *.webm *.avi"),
                ("All files", "*.*"),
            ],
        )
        if path:
            self.path_var.set(path)
            self._load_video(path)

    def _browse_out(self):
        path = filedialog.askdirectory(title="Output folder")
        if path:
            self.out_var.set(path)

    def _try_load_path(self):
        if self.source_mode.get() != "path":
            return
        raw = self.path_var.get().strip().strip('"').strip("'")
        if raw and Path(raw).is_file():
            self._load_video(raw)

    def _load_video(self, path: str):
        try:
            analyzer = VideoAnalyzer()
            meta = analyzer.get_metadata(path)
            self.video_path = str(Path(path).resolve())
            self.display_name = Path(path).name
            self.meta = meta
            gb = Path(path).stat().st_size / (1024 ** 3)
            self.source_status.config(
                text=f"Ready: {self.display_name}  ·  {gb:.2f} GB", fg=SUCCESS
            )
            mins = meta.duration / 60.0
            self.metric_labels["Duration"].config(text=f"{mins:.1f} min")
            self.metric_labels["Resolution"].config(text=f"{meta.width}×{meta.height}")
            self.metric_labels["FPS"].config(text=f"{meta.fps:.1f}")
            self.metric_labels["Audio"].config(text="Yes" if meta.has_audio else "No")
            hours = meta.duration / 3600.0
            if hours >= 2 and self.mode_var.get().startswith("Shorts"):
                self.preview_note.config(
                    text=f"{hours:.1f}h VOD → TURBO mode (audio peaks + parallel encodes)."
                )
            elif self.mode_var.get().startswith("Fast clip"):
                self.preview_note.config(
                    text=f"Will export the last {self.last_secs_var.get()} seconds only."
                )
            else:
                self.preview_note.config(text="")
            self._update_eta()
            self._log(f"Loaded: {self.display_name}")
        except Exception as e:
            self.video_path = None
            self.meta = None
            self.source_status.config(text=f"Could not read video: {e}", fg=DANGER)
            for k in self.metric_labels:
                self.metric_labels[k].config(text="—")

    def _update_eta(self):
        if not self.meta:
            self.eta_label.config(text="Estimated time: —")
            return
        est = estimate_job_seconds(
            self.meta.duration,
            mode=self.mode_var.get(),
            count=self.count_var.get(),
            quality=self.quality_var.get(),
            captions=self.captions_var.get(),
        )
        if est < 60:
            txt = f"~{int(est)} seconds"
        elif est < 3600:
            txt = f"~{int(est // 60)} min"
        else:
            txt = f"~{est / 3600:.1f} hours"
        self.eta_label.config(text=f"Estimated time: {txt}  (CPU / disk / captions may vary)")

    def _download_youtube(self):
        url = self.path_var.get().strip()
        if not url:
            messagebox.showwarning("YouTube", "Paste a YouTube URL first.")
            return
        if not ytdlp_available():
            messagebox.showerror(
                "yt-dlp missing",
                "Install yt-dlp in the app venv:\n"
                "  pip install yt-dlp",
            )
            return

        def work():
            self._busy = True
            self.start_btn.config(state=tk.DISABLED)
            self.after(0, lambda: self._set_progress(5, "Downloading from YouTube…"))
            self.after(0, lambda: self._log("Downloading…"))
            try:
                path = download_video(url, str(_download_dir()))
                self.after(0, lambda: self._load_video(path))
                self.after(0, lambda: self._set_progress(0, "Download complete"))
                self.after(0, lambda: self._log(f"Downloaded: {path}"))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Download failed", str(e)))
                self.after(0, lambda: self._set_progress(0, "Download failed"))
            finally:
                self._busy = False
                self.after(0, lambda: self.start_btn.config(state=tk.NORMAL))

        threading.Thread(target=work, daemon=True).start()

    def _start(self):
        if self._busy:
            messagebox.showinfo("Busy", "Already processing. Please wait.")
            return
        if not self.video_path or not self.meta:
            messagebox.showwarning("No video", "Load a video first (path, browse, or YouTube).")
            return
        out_dir = self.out_var.get().strip()
        if not out_dir:
            messagebox.showwarning("Output", "Choose an output folder.")
            return
        Path(out_dir).mkdir(parents=True, exist_ok=True)

        os.environ["VOD2CONTENT_WHISPER_MODEL"] = self.caption_model_var.get()
        os.environ["VOD2CONTENT_WHISPER_LANG"] = "en"

        mode = self.mode_var.get()
        game = self._selected_game()
        count = self.count_var.get()
        quality = self.quality_var.get()
        topic = self.topic_var.get()
        captions = self.captions_var.get()
        last_secs = self.last_secs_var.get()
        video_path = self.video_path
        duration = self.meta.duration

        self._busy = True
        self.start_btn.config(state=tk.DISABLED)
        self._set_progress(2, "Starting…")
        self._log(f"Job: {mode} | game={game} | quality={quality}")

        def work():
            try:
                if mode.startswith("Fast clip"):
                    self.after(0, lambda: self._set_progress(15, f"Clipping last {last_secs}s…"))
                    from vod2content.cli import process_clip
                    process_clip(
                        video_path, out_dir, last_seconds=float(last_secs),
                        quality=quality, vertical=True, topic=topic, game=game,
                        generate_meta=True,
                    )
                    self.after(0, lambda: self._set_progress(100, "Done"))
                    self.after(0, lambda: self._log(f"Saved last {last_secs}s → {out_dir}"))
                    self.after(0, lambda: messagebox.showinfo("Done", f"Clip saved to:\n{out_dir}"))

                elif mode.startswith("Analyze"):
                    self.after(0, lambda: self._set_progress(20, "Detecting moments…"))
                    analyzer = VideoAnalyzer()
                    peaks = analyzer.suggest_shorts_candidates(
                        video_path, game=game, target_count=count, turbo=duration >= 1800
                    )
                    report = {
                        "source": self.display_name,
                        "game": game,
                        "candidates": [
                            {
                                "start": s.start, "end": s.end,
                                "duration": round(s.duration, 2),
                                "score": s.score, "reason": s.reason,
                            }
                            for s in peaks
                        ],
                    }
                    rp = Path(out_dir) / "analysis_report.json"
                    rp.write_text(json.dumps(report, indent=2), encoding="utf-8")
                    self.after(0, lambda: self._set_progress(100, "Done"))
                    self.after(0, lambda: self._log(f"{len(peaks)} moments → {rp}"))
                    self.after(0, lambda: messagebox.showinfo("Done", f"Found {len(peaks)} moments.\n{rp}"))

                elif mode.startswith("Shorts"):
                    est = estimate_job_seconds(duration, mode, count, quality, captions)

                    def on_progress(frac, msg):
                        pct = min(99, frac * 100)
                        remain = max(0, est * (1 - frac))
                        if remain < 60:
                            eta = f"~{int(remain)}s left"
                        else:
                            eta = f"~{int(remain // 60)}m {int(remain % 60)}s left"
                        self.after(0, lambda: self._set_progress(pct, f"{msg}  ·  {eta}"))
                        self.after(0, lambda: self._log(msg))

                    on_progress(0.05, "Detecting highlights…")
                    from vod2content.cli import process_shorts
                    results = process_shorts(
                        video_path, out_dir, count=count, topic=topic, quality=quality,
                        platform="youtube_shorts", generate_meta=True, game=game,
                        auto_captions=captions, on_progress=on_progress,
                    )
                    self.after(0, lambda: self._set_progress(100, "Done"))
                    self.after(0, lambda: self._log(f"{len(results)} Shorts → {out_dir}"))
                    self.after(0, lambda: messagebox.showinfo(
                        "Done", f"Created {len(results)} Shorts in:\n{out_dir}"
                    ))

                else:
                    self.after(0, lambda: self._set_progress(15, "Building long-form reel…"))
                    from vod2content.cli import process_longform
                    process_longform(
                        video_path, out_dir, max_segments=count, topic=topic,
                        quality=quality, remove_silence=False, game=game,
                    )
                    self.after(0, lambda: self._set_progress(100, "Done"))
                    self.after(0, lambda: self._log(f"Long-form → {out_dir}"))
                    self.after(0, lambda: messagebox.showinfo("Done", f"Long-form saved to:\n{out_dir}"))

            except Exception:
                err = traceback.format_exc()
                self.after(0, lambda: self._log(err))
                self.after(0, lambda: self._set_progress(0, "Failed"))
                self.after(0, lambda: messagebox.showerror("Error", err[-1500:]))
            finally:
                self._busy = False
                self.after(0, lambda: self.start_btn.config(state=tk.NORMAL))

        self._worker = threading.Thread(target=work, daemon=True)
        self._worker.start()

    def _on_close(self):
        if self._busy:
            if not messagebox.askyesno("Quit", "A job is running. Quit anyway?"):
                return
        self.destroy()


def main():
    app = VOD2ContentApp()
    # Center on screen
    app.update_idletasks()
    w, h = app.winfo_width(), app.winfo_height()
    x = (app.winfo_screenwidth() - w) // 2
    y = (app.winfo_screenheight() - h) // 2
    app.geometry(f"+{x}+{y}")
    app.mainloop()


if __name__ == "__main__":
    main()
