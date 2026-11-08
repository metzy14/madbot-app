"""Run one Vod2Content job. The job JSON path is the only argument."""

import json
import sys
from pathlib import Path

from vod2content.cli import analyze_only, process_clip, process_longform, process_shorts
from vod2content.downloader import download_video


def main():
    job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    source = str(job.get("input") or "").strip()
    output = job["output"]
    if not source:
        raise SystemExit("Pick a video file or paste a VOD link.")
    if source.startswith("http://") or source.startswith("https://"):
        print("Downloading the VOD...", flush=True)
        source = download_video(source, str(Path(output) / "downloads"))
        print(f"Downloaded {source}", flush=True)
    elif not Path(source).exists():
        raise SystemExit(f"Cannot find {source}")

    command = job.get("command") or "shorts"
    print(f"Starting {command}...", flush=True)
    if command == "shorts":
        process_shorts(
            source,
            output,
            count=int(job.get("count") or 6),
            topic=job.get("topic") or "highlights",
            quality=job.get("quality") or "medium",
            platform=job.get("platform") or "youtube_shorts",
            game=job.get("game") or "generic",
        )
    elif command == "clip":
        process_clip(
            source,
            output,
            last_seconds=float(job.get("seconds") or 60),
            quality=job.get("quality") or "medium",
            topic=job.get("topic") or "clip",
            game=job.get("game") or "generic",
        )
    elif command == "long":
        process_longform(
            source,
            output,
            max_segments=int(job.get("count") or 8),
            topic=job.get("topic") or "highlights",
            quality=job.get("quality") or "medium",
            game=job.get("game") or "generic",
        )
    elif command == "analyze":
        analyze_only(source, output, game=job.get("game") or "generic")
    else:
        raise SystemExit(f"Unknown job {command}")
    print("Done. Shorts are in the output folder.", flush=True)


if __name__ == "__main__":
    main()
