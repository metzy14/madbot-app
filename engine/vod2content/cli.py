#!/usr/bin/env python3
"""
VOD2Content CLI – Turn VODs & clips into algorithm-ready Shorts and long-form videos.
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import List, Optional

from .analyzer import VideoAnalyzer, HighlightSegment
from .editor import VideoEditor
from .optimizer import AlgorithmOptimizer, ContentPackage
from .game_profiles import get_profile, list_profiles


def print_banner():
    print(r"""
╔══════════════════════════════════════════════════════════════╗
║                      VOD2CONTENT v2.0                        ║
║     VODs & Clips → Shorts + Long-form + Algorithm Ready      ║
║         Game-aware highlights • YouTube • TikTok • Reels     ║
╚══════════════════════════════════════════════════════════════╝
""")


def ensure_dir(path: str) -> Path:
    p = Path(path)
    p.mkdir(parents=True, exist_ok=True)
    return p


def process_shorts(
    input_path: str,
    output_dir: str,
    count: int = 6,
    topic: str = "highlights",
    quality: str = "high",
    platform: str = "youtube_shorts",
    text_overlay: Optional[str] = None,
    generate_meta: bool = True,
    game: str = "generic",
    auto_captions: bool = True,
):
    analyzer = VideoAnalyzer()
    editor = VideoEditor()
    optimizer = AlgorithmOptimizer()
    profile = get_profile(game)

    out = ensure_dir(output_dir)
    meta = analyzer.get_metadata(input_path)
    print(f"\n📹 Source: {Path(input_path).name}")
    print(f"   Duration: {meta.duration:.1f}s | {meta.width}x{meta.height} @ {meta.fps:.2f}fps")
    print(f"   Game profile: {profile.name} ({profile.id})")

    print(f"\n🔍 Detecting exciting moments for {profile.name}...")
    if on_progress:
        on_progress(0.05, "Detecting highlights…")
    # Always prefer turbo on long VODs so wall time can stay under ~15 min
    candidates = analyzer.suggest_shorts_candidates(
        input_path, game=game, target_count=count, turbo=(meta.duration >= 1800)
    )
    if on_progress:
        on_progress(0.45, f"Found {len(candidates)} moments — encoding…")
    if not candidates:
        print("⚠️  No strong moments found. Falling back to evenly spaced segments.")
        step = meta.duration / (count + 1)
        candidates = [
            HighlightSegment(start=i*step, end=min(meta.duration, i*step+28), score=0.5, reason="fallback", game_profile=profile.id)
            for i in range(1, count+1)
        ]

    print(f"   Found {len(candidates)} candidate segments.")
    for c in candidates[:5]:
        print(f"      • {c.start:7.1f}s–{c.end:7.1f}s  score={c.score:.2f}  ({c.reason})")

    results = []
    # Parallel encodes — big win when making multiple Shorts
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _render_one(i_seg):
        i, seg = i_seg
        out_file = out / f"short_{i:02d}_{int(seg.start)}s.mp4"
        overlay = text_overlay or f"Moment #{i}"
        # Skip zoom on long-VOD/fast jobs — zoompan is expensive
        use_zoom = meta.duration < 1800 and quality == "high"
        ed = VideoEditor()
        ed.create_short(
            source=input_path,
            output=str(out_file),
            start=seg.start,
            end=seg.end,
            target_aspect="9:16",
            text_overlay=overlay,
            zoom=use_zoom,
            quality=quality,
            auto_captions=auto_captions,
        )
        thumb = out / f"short_{i:02d}_thumb.jpg"
        try:
            ed.generate_thumbnail(
                source=input_path,
                output=str(thumb),
                timestamp=seg.start + (seg.end - seg.start) * 0.3,
                text="WAIT FOR IT",
            )
        except Exception:
            pass
        pkg = None
        if generate_meta:
            pkg = optimizer.generate_package(
                topic=topic if topic != "highlights" else profile.default_topic,
                platform=platform,
                duration_sec=seg.duration,
                game=game,
            )
            meta_file = out / f"short_{i:02d}_metadata.json"
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump({
                    "title": pkg.title,
                    "description": pkg.description,
                    "tags": pkg.tags,
                    "hashtags": pkg.hashtags,
                    "hook": pkg.hook_script,
                    "cta": pkg.cta,
                    "thumbnail_text": pkg.thumbnail_text,
                    "posting_tips": pkg.posting_tips,
                    "game_profile": pkg.game_profile,
                    "segment": {"start": seg.start, "end": seg.end, "score": seg.score, "reason": seg.reason},
                }, f, indent=2, ensure_ascii=False)
        return {
            "file": str(out_file),
            "segment": seg,
            "package": pkg,
            "index": i,
        }

    workers = min(4, max(1, len(candidates)))
    print(f"\n✂️  Rendering {len(candidates)} Shorts with {workers} parallel workers...")
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(_render_one, (i, seg)): i for i, seg in enumerate(candidates, 1)}
        for fut in as_completed(futs):
            i = futs[fut]
            try:
                r = fut.result()
                results.append(r)
                print(f"   ✅ Short {r['index']}: {Path(r['file']).name}")
                if r.get("package"):
                    print(f"      🎯 {r['package'].title}")
                if on_progress and len(candidates) > 0:
                    done = len(results)
                    frac = 0.45 + 0.50 * (done / len(candidates))
                    on_progress(frac, f"Encoded {done}/{len(candidates)} Shorts…")
            except Exception as e:
                print(f"   ❌ Short {i} failed: {e}")

    results.sort(key=lambda r: r["index"])

    # Summary markdown
    summary = out / "SHORTS_SUMMARY.md"
    with open(summary, "w", encoding="utf-8") as f:
        f.write(f"# Shorts generated from {Path(input_path).name}\n\n")
        for i, r in enumerate(results, 1):
            f.write(f"## Short {i}\n")
            f.write(f"- File: `{Path(r['file']).name}`\n")
            f.write(f"- Time: {r['segment'].start:.1f}s – {r['segment'].end:.1f}s\n")
            if r.get("package"):
                f.write(f"- Title: {r['package'].title}\n")
                f.write(f"- Hook: {r['package'].hook_script}\n")
            f.write("\n")
    print(f"\n📋 Summary written to {summary}")
    return results


def process_longform(
    input_path: str,
    output_dir: str,
    max_segments: int = 12,
    topic: str = "highlights",
    quality: str = "high",
    remove_silence: bool = False,
    game: str = "generic",
):
    analyzer = VideoAnalyzer()
    editor = VideoEditor()
    optimizer = AlgorithmOptimizer()
    profile = get_profile(game)

    out = ensure_dir(output_dir)
    meta = analyzer.get_metadata(input_path)
    print(f"\n📹 Source: {Path(input_path).name} ({meta.duration/60:.1f} min)")
    print(f"   Game profile: {profile.name}")

    print(f"🔍 Selecting best moments for {profile.name} long-form reel...")
    segments = analyzer.suggest_shorts_candidates(
        input_path, game=game, target_count=max_segments, min_len=15, max_len=90
    )
    # Prefer slightly longer clips for long-form
    for s in segments:
        if s.duration < 25:
            s.end = min(meta.duration, s.start + 35)

    print(f"   Using {len(segments)} segments.")

    out_file = out / "longform_highlights.mp4"
    print(f"\n🎬 Rendering long-form highlight reel → {out_file.name}")
    editor.create_longform_highlight_reel(
        source=input_path,
        output=str(out_file),
        segments=segments,
        quality=quality,
        target_aspect="16:9",
    )
    print("   ✅ Done.")

    if remove_silence:
        tight = out / "longform_highlights_tight.mp4"
        print("🔇 Removing silence for tighter pacing...")
        editor.remove_silence(str(out_file), str(tight), quality=quality)
        print(f"   ✅ Tight version: {tight.name}")

    # Metadata
    pkg = optimizer.generate_package(
        topic=topic if topic != "highlights" else profile.default_topic,
        platform="youtube_long",
        duration_sec=meta.duration,
        game=game,
    )
    meta_path = out / "longform_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump({
            "title": pkg.title,
            "description": pkg.description,
            "tags": pkg.tags,
            "hashtags": pkg.hashtags,
            "hook": pkg.hook_script,
            "cta": pkg.cta,
            "posting_tips": pkg.posting_tips,
            "alt_titles": pkg.alt_titles,
            "game_profile": pkg.game_profile,
            "segments_used": [{"start": s.start, "end": s.end, "score": s.score, "reason": s.reason} for s in segments],
        }, f, indent=2, ensure_ascii=False)
    print(f"📝 Metadata: {meta_path.name}")
    print(f"🎯 Title idea: {pkg.title}")

    # Thumbnail
    if segments:
        mid = segments[0].start + (segments[0].end - segments[0].start) / 2
        editor.generate_thumbnail(input_path, str(out / "longform_thumb.jpg"), mid, text=pkg.thumbnail_text)


def analyze_only(input_path: str, output_dir: str, game: str = "generic"):
    analyzer = VideoAnalyzer()
    profile = get_profile(game)
    out = ensure_dir(output_dir)
    meta = analyzer.get_metadata(input_path)
    peaks = analyzer.suggest_shorts_candidates(input_path, game=game, target_count=15)

    report = {
        "metadata": meta.to_dict(),
        "game_profile": {"id": profile.id, "name": profile.name},
        "highlight_candidates": [
            {"start": s.start, "end": s.end, "duration": s.duration, "score": s.score, "reason": s.reason}
            for s in peaks
        ],
    }
    report_path = out / "analysis_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"📊 Analysis saved to {report_path}")
    print(f"   Game profile: {profile.name}")
    print(f"   Duration: {meta.duration:.1f}s | Candidates: {len(peaks)}")
    for i, s in enumerate(peaks[:8], 1):
        print(f"   {i}. {s.start:7.1f}s – {s.end:7.1f}s  (score {s.score:.2f})  [{s.reason}]")


def process_clip(
    input_path: str,
    output_dir: str,
    last_seconds: float = 60.0,
    quality: str = "medium",
    vertical: bool = True,
    topic: str = "clip",
    game: str = "generic",
    generate_meta: bool = True,
):
    """Clip the last N seconds of a VOD — fast path, no analysis."""
    editor = VideoEditor()
    optimizer = AlgorithmOptimizer()
    analyzer = VideoAnalyzer()
    out = ensure_dir(output_dir)
    meta = analyzer.get_metadata(input_path)
    secs = min(float(last_seconds), float(meta.duration))
    print(f"\n📹 Source: {Path(input_path).name} ({meta.duration/60:.1f} min)")
    print(f"⚡ Fast clip: last {secs:.1f}s (no full-VOD analysis)")

    aspect = "9:16" if vertical else "16:9"
    out_file = out / f"clip_last_{int(secs)}s.mp4"
    editor.clip_last_seconds(
        source=input_path,
        output=str(out_file),
        seconds=secs,
        target_aspect=aspect,
        quality=quality,
        text_overlay=None,
    )
    # Professional captions on the finished clip
    try:
        from .captions import whisper_available, caption_clip, burn_captions
        if whisper_available():
            import tempfile, shutil
            meta_d = analyzer.get_metadata(input_path)
            start = max(0.0, meta_d.duration - secs)
            with tempfile.TemporaryDirectory() as td:
                ass = caption_clip(input_path, start, meta_d.duration, td, ffmpeg=editor.ffmpeg)
                if ass:
                    tmpo = str(out_file) + ".cap.mp4"
                    burn_captions(str(out_file), tmpo, ass, ffmpeg=editor.ffmpeg,
                                  quality_args=editor._quality_args(quality))
                    shutil.move(tmpo, str(out_file))
                    print("   字幕 Captions burned in")
        else:
            print("   (Install faster-whisper for auto-subtitles)")
    except Exception as e:
        print(f"   Captions skipped: {e}")
    print(f"   ✅ Saved: {out_file.name}")

    try:
        editor.generate_thumbnail(
            source=input_path,
            output=str(out / f"clip_last_{int(secs)}s_thumb.jpg"),
            timestamp=max(0.0, meta.duration - secs / 2),
            text="CLIP",
        )
    except Exception:
        pass

    if generate_meta:
        pkg = optimizer.generate_package(
            topic=topic,
            platform="youtube_shorts" if vertical else "youtube_long",
            duration_sec=secs,
            game=game,
        )
        meta_path = out / f"clip_last_{int(secs)}s_metadata.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump({
                "title": pkg.title,
                "description": pkg.description,
                "tags": pkg.tags,
                "hashtags": pkg.hashtags,
                "hook": pkg.hook_script,
                "cta": pkg.cta,
                "clip": {"mode": "last_seconds", "seconds": secs},
            }, f, indent=2, ensure_ascii=False)
        print(f"   📝 {meta_path.name}")
        print(f"   🎯 {pkg.title}")
    return str(out_file)


def main():
    print_banner()
    parser = argparse.ArgumentParser(
        description="VOD2Content – Game-aware Shorts & Long-form editor with algorithm optimization",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # iRacing Shorts
  vod2content shorts my_race.mp4 -o ./output --game iracing --count 8

  # Escape from Tarkov Shorts
  vod2content shorts tarkov_raid.mp4 -o ./output --game tarkov --topic "Labs raid"

  # Long-form highlight reel for FPS
  vod2content long my_stream.mp4 -o ./output --game fps --remove-silence

  # Just analyze with racing profile
  vod2content analyze my_race.mp4 --game iracing

  # List available game profiles
  vod2content profiles

  # Fast: last 60 seconds of a VOD
  vod2content clip my_vod.mp4 60 -o ./out

  # Generate metadata only
  vod2content optimize --topic "last lap battle" --game iracing --platform youtube_shorts
        """
    )

    sub = parser.add_subparsers(dest="command", required=True)

    # Shorts command
    p_short = sub.add_parser("shorts", help="Create vertical Shorts / Reels / TikToks")
    p_short.add_argument("input", help="Video file or directory of videos")
    p_short.add_argument("-o", "--output", default="./output_shorts", help="Output directory")
    p_short.add_argument("-n", "--count", type=int, default=6, help="Number of Shorts per video")
    p_short.add_argument("--topic", default="highlights", help="Main topic / niche keyword")
    p_short.add_argument("--game", default="generic", help="Game profile (iracing, tarkov, fps, ...)")
    p_short.add_argument("--quality", choices=["high", "medium", "draft"], default="high")
    p_short.add_argument("--platform", default="youtube_shorts",
                         choices=["youtube_shorts", "tiktok", "instagram"])
    p_short.add_argument("--overlay", default=None, help="Text overlay / hook text")
    p_short.add_argument("--no-meta", action="store_true", help="Skip metadata generation")

    # Long-form
    p_long = sub.add_parser("long", help="Create long-form highlight reel")
    p_long.add_argument("input", help="Video file")
    p_long.add_argument("-o", "--output", default="./output_long", help="Output directory")
    p_long.add_argument("-n", "--max-segments", type=int, default=10)
    p_long.add_argument("--topic", default="highlights")
    p_long.add_argument("--game", default="generic", help="Game profile")
    p_long.add_argument("--quality", choices=["high", "medium", "draft"], default="high")
    p_long.add_argument("--remove-silence", action="store_true", help="Also create a silence-removed version")

    # Analyze
    p_ana = sub.add_parser("analyze", help="Only analyze and list best moments")
    p_ana.add_argument("input", help="Video file")
    p_ana.add_argument("-o", "--output", default="./analysis", help="Output directory")
    p_ana.add_argument("--game", default="generic", help="Game profile")

    # Profiles list
    sub.add_parser("profiles", help="List available game profiles")

    p_clip = sub.add_parser("clip", help="Fast: export last N seconds (e.g. clip 60)")
    p_clip.add_argument("input", help="Video file")
    p_clip.add_argument("seconds", type=float, nargs="?", default=60.0,
                        help="Seconds from the end of the VOD (default: 60)")
    p_clip.add_argument("-o", "--output", default="./output_clip")
    p_clip.add_argument("--quality", choices=["high", "medium", "draft"], default="medium")
    p_clip.add_argument("--horizontal", action="store_true", help="16:9 instead of vertical")
    p_clip.add_argument("--topic", default="clip")
    p_clip.add_argument("--game", default="generic")
    p_clip.add_argument("--no-meta", action="store_true")

    # Info / optimize only
    p_opt = sub.add_parser("optimize", help="Generate titles, tags, descriptions only")
    p_opt.add_argument("--topic", required=True)
    p_opt.add_argument("--game", default="generic", help="Game profile for better keywords/hooks")
    p_opt.add_argument("--platform", default="youtube_shorts",
                       choices=["youtube_shorts", "youtube_long", "tiktok", "instagram"])
    p_opt.add_argument("-o", "--output", default="./metadata")

    args = parser.parse_args()

    if args.command == "profiles":
        print("\nAvailable game profiles:\n")
        for p in list_profiles():
            print(f"  {p['id']:16}  {p['name']}")
            print(f"  {'':16}  {p['description'][:70]}")
            print()
        print("Usage:  --game iracing   or   --game tarkov   or   --game fps")
        print("Aliases work too: racing, eft, cs2, warzone, wow, etc.\n")
        return

    if args.command == "shorts":
        inputs = []
        p = Path(args.input)
        if p.is_dir():
            for ext in ("*.mp4", "*.mkv", "*.mov", "*.webm", "*.avi"):
                inputs.extend(p.glob(ext))
        else:
            inputs = [p]

        if not inputs:
            print("❌ No video files found.")
            sys.exit(1)

        for inp in inputs:
            process_shorts(
                str(inp),
                args.output,
                count=args.count,
                topic=args.topic,
                quality=args.quality,
                platform=args.platform,
                text_overlay=args.overlay,
                generate_meta=not args.no_meta,
                game=args.game,
            )

    elif args.command == "long":
        process_longform(
            args.input,
            args.output,
            max_segments=args.max_segments,
            topic=args.topic,
            quality=args.quality,
            remove_silence=args.remove_silence,
            game=args.game,
        )

    elif args.command == "analyze":
        analyze_only(args.input, args.output, game=args.game)

    elif args.command == "clip":
        process_clip(
            args.input,
            args.output,
            last_seconds=args.seconds,
            quality=args.quality,
            vertical=not args.horizontal,
            topic=args.topic,
            game=args.game,
            generate_meta=not args.no_meta,
        )

    elif args.command == "optimize":
        opt = AlgorithmOptimizer()
        pkg = opt.generate_package(args.topic, platform=args.platform, game=getattr(args, "game", "generic"))
        out = ensure_dir(args.output)
        path = out / f"package_{args.platform}.json"
        with open(path, "w", encoding="utf-8") as f:
            json.dump({
                "title": pkg.title,
                "alt_titles": pkg.alt_titles,
                "description": pkg.description,
                "tags": pkg.tags,
                "hashtags": pkg.hashtags,
                "hook": pkg.hook_script,
                "cta": pkg.cta,
                "thumbnail_text": pkg.thumbnail_text,
                "posting_tips": pkg.posting_tips,
                "suggested_duration": pkg.suggested_duration,
                "game_profile": pkg.game_profile,
            }, f, indent=2, ensure_ascii=False)
        print(f"✅ Content package saved to {path}")
        print(f"\nTitle: {pkg.title}")
        print(f"Hook:  {pkg.hook_script}")
        print(f"CTA:   {pkg.cta}")
        print(f"Game:  {pkg.game_profile}")

    print("\n✨ All done! Review the output folder and upload.\n")


if __name__ == "__main__":
    main()
