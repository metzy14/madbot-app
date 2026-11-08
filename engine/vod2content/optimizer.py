"""
Algorithm optimization helpers for YouTube, TikTok, Instagram, etc.
Generates titles, descriptions, tags, hooks, CTAs, and posting recommendations
based on best practices (updated knowledge as of 2025-2026).
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Any
import random
import re
from datetime import datetime

from .game_profiles import get_profile, GameProfile


@dataclass
class ContentPackage:
    """Everything needed to publish a video for maximum algorithm performance."""
    title: str
    description: str
    tags: List[str]
    hashtags: List[str]
    thumbnail_text: str
    hook_script: str          # First 1-3 seconds spoken / on-screen
    cta: str
    suggested_duration: str
    platform: str
    posting_tips: List[str]
    chapters: List[Dict[str, str]] = field(default_factory=list)
    alt_titles: List[str] = field(default_factory=list)
    game_profile: str = "generic"


class AlgorithmOptimizer:
    """
    Platform-aware + game-aware content packaging.
    Focuses on retention, CTR, and session time – the core ranking signals.
    """

    # Evergreen high-performing patterns (2024-2026 research consensus)
    HOOK_TEMPLATES = [
        "Wait for it... {topic}",
        "This is the craziest {topic} I've ever seen",
        "POV: You just discovered the best {topic}",
        "I can't believe this actually worked...",
        "The moment everything changed:",
        "Nobody talks about this part of {topic}",
        "Watch till the end 😱",
        "This one tip changed my {topic} forever",
        "You won't believe what happens next",
        "Stop scrolling if you care about {topic}",
    ]

    TITLE_FORMULAS = {
        "youtube_shorts": [
            "{hook} | {topic}",
            "This {topic} is INSANE 🔥",
            "{number} Seconds of Pure {emotion}",
            "Why everyone is talking about {topic}",
            "I tried {topic} so you don't have to",
        ],
        "youtube_long": [
            "The Ultimate {topic} Guide (2026)",
            "I Spent {time} Learning {topic} – Here's What I Found",
            "{topic}: Everything You Need to Know",
            "How I Mastered {topic} in Record Time",
            "The Truth About {topic} Nobody Tells You",
        ],
        "tiktok": [
            "{hook}",
            "Tell me you're into {topic} without telling me...",
            "This {topic} hack is underrated",
            "Rating {topic} moments until...",
        ],
        "instagram": [
            "{hook} ✨",
            "Save this for later 📌 {topic}",
            "The {topic} energy we needed",
        ],
    }

    CTA_TEMPLATES = [
        "Follow for more {topic} content!",
        "Like & comment your biggest takeaway below 👇",
        "Which part was your favorite? Tell me in the comments!",
        "Subscribe and turn on notifications so you never miss a {topic} video",
        "Share this with someone who needs to see it",
        "Drop a 🔥 if you made it to the end",
    ]

    def __init__(self, niche: str = "gaming", brand_voice: str = "energetic"):
        self.niche = niche
        self.brand_voice = brand_voice

    def _clean_keyword(self, text: str) -> str:
        return re.sub(r"[^\w\s]", "", text).strip().lower()

    def generate_package(
        self,
        topic: str,
        platform: str = "youtube_shorts",
        duration_sec: float = 30.0,
        keywords: Optional[List[str]] = None,
        is_series: bool = False,
        episode: Optional[int] = None,
        game: str = "generic",
    ) -> ContentPackage:
        profile = get_profile(game)
        topic_clean = topic.strip() if topic and topic != "highlights" else profile.default_topic
        keywords = keywords or [topic_clean] + profile.title_keywords[:4]

        # Prefer game-specific hooks when available
        game_hooks = profile.hook_styles or []
        all_hooks = game_hooks + [h.format(topic=topic_clean) for h in self.HOOK_TEMPLATES]
        chosen_hook = random.choice(all_hooks)

        # Title
        formulas = self.TITLE_FORMULAS.get(platform, self.TITLE_FORMULAS["youtube_shorts"])
        # Inject game keywords into emotion/topic variety
        emotions = ["Chaos", "Hype", "Insanity", "Skill", "Drama"]
        if profile.id == "iracing":
            emotions = ["Crash", "Overtake", "Last Lap", "Pole", "Battle"]
        elif profile.id == "tarkov":
            emotions = ["Clutch", "Extract", "Headshot", "Raid", "Ammo"]
        elif profile.id == "fps":
            emotions = ["Clutch", "Ace", "1v5", "Eco", "Headshot"]

        base_title = random.choice(formulas).format(
            hook=chosen_hook,
            topic=topic_clean,
            number=int(duration_sec),
            emotion=random.choice(emotions),
            time=random.choice(["100 hours", "30 days", "a year", "months"]),
        )
        title = base_title[:100]

        alt_titles = []
        for f in formulas[:3]:
            try:
                alt_titles.append(f.format(
                    topic=topic_clean, hook=chosen_hook, number=int(duration_sec),
                    emotion=random.choice(emotions), time="weeks"
                )[:100])
            except Exception:
                pass

        # Description
        if platform.startswith("youtube"):
            description = self._youtube_description(topic_clean, keywords, duration_sec, is_series, episode)
        else:
            description = self._shortform_description(topic_clean, keywords)

        tags = self._generate_tags(topic_clean, keywords, platform, profile)
        hashtags = self._generate_hashtags(topic_clean, platform, profile)

        # Hook for the first 1-3 seconds – prefer game style
        hook = chosen_hook

        cta = random.choice(self.CTA_TEMPLATES).format(topic=topic_clean)

        # Thumbnail text – game flavored
        thumb_options = ["WAIT FOR IT", "INSANE", "WATCH THIS", "GONE WRONG?", "EPIC FAIL", "CLUTCH", "UNREAL"]
        if profile.id == "iracing":
            thumb_options = ["CRASH", "LAST LAP", "OVERTAKE", "POLE", "BATTLE", "WIN", "ENGINE"]
        elif profile.id == "tarkov":
            thumb_options = ["EXTRACT", "CLUTCH", "HEADSHOT", "RAID", "ONE MAG", "BOSS", "SURVIVED"]
        elif profile.id == "fps":
            thumb_options = ["ACE", "1v5", "CLUTCH", "HEADSHOT", "ECO ROUND", "NINJA"]
        thumb_text = random.choice(thumb_options)

        # Posting tips
        tips = self._posting_tips(platform)

        # Suggested duration guidance
        if platform in ("youtube_shorts", "tiktok", "instagram"):
            sug_dur = "15-45 seconds (sweet spot for completion rate)"
        else:
            sug_dur = "8-15 minutes for new channels; 12-25 min once established"

        return ContentPackage(
            title=title,
            description=description,
            tags=tags,
            hashtags=hashtags,
            thumbnail_text=thumb_text,
            hook_script=hook,
            cta=cta,
            suggested_duration=sug_dur,
            platform=platform,
            posting_tips=tips,
            alt_titles=alt_titles,
            game_profile=profile.id,
        )

    def _youtube_description(self, topic: str, keywords: List[str], dur: float, is_series: bool, ep: Optional[int]) -> str:
        lines = [
            f"{topic} – full breakdown and best moments.",
            "",
            "⏱️ TIMESTAMPS",
            "0:00 Intro / Hook",
            "0:15 The moment everything changed",
            f"{max(1, int(dur*0.4))}:00 Key highlight",
            f"{max(2, int(dur*0.8))}:00 Final result",
            "",
            "🔔 Subscribe for more content like this!",
            "👍 Like if you enjoyed the video",
            "💬 Comment your thoughts below",
            "",
            "—" * 20,
            f"Keywords: {', '.join(keywords[:8])}",
            "",
            "#shorts" if dur < 60 else "",
            f"#{self._clean_keyword(topic).replace(' ', '')}",
        ]
        if is_series and ep:
            lines.insert(1, f"Episode {ep} of the series.")
        return "\n".join(line for line in lines if line is not None)

    def _shortform_description(self, topic: str, keywords: List[str]) -> str:
        return (
            f"{topic} 🔥\n\n"
            f"{' '.join('#' + self._clean_keyword(k).replace(' ', '') for k in keywords[:5])}\n"
            f"#fyp #viral #foryou"
        )

    def _generate_tags(self, topic: str, keywords: List[str], platform: str, profile: Optional[GameProfile] = None) -> List[str]:
        base = [topic, self.niche] + keywords
        if profile:
            base += profile.title_keywords
        extras = [
            "highlights", "best moments", "funny", "epic", "clutch",
            "2026", "tutorial" if "guide" in topic.lower() else "reaction",
            "shorts" if "short" in platform else "full video",
        ]
        tags = list(dict.fromkeys([t.lower().strip() for t in base + extras if t]))[:15]
        return tags

    def _generate_hashtags(self, topic: str, platform: str, profile: Optional[GameProfile] = None) -> List[str]:
        core = [f"#{self._clean_keyword(topic).replace(' ', '')}", f"#{self.niche}"]
        if profile:
            for kw in profile.title_keywords[:3]:
                core.append(f"#{self._clean_keyword(kw).replace(' ', '')}")
        if platform in ("tiktok", "instagram", "youtube_shorts"):
            core += ["#fyp", "#viral", "#foryou", "#foryoupage", "#trending"]
        if platform == "youtube_shorts":
            core.append("#shorts")
        return list(dict.fromkeys(core))[:12]

    def _posting_tips(self, platform: str) -> List[str]:
        common = [
            "Post when your audience is most active (check YouTube Analytics → Audience).",
            "First 3 seconds must stop the scroll – use motion + text + audio spike.",
            "End screens / related videos boost session time.",
        ]
        if platform == "youtube_shorts":
            return common + [
                "Keep under 60 seconds. 20-40s often performs best for completion rate.",
                "Use trending audio when it fits (but original audio can also win).",
                "Vertical 9:16, 1080x1920, high bitrate.",
                "Add captions – majority watch muted.",
                "Series / playlists of Shorts help the algorithm understand your niche.",
            ]
        if platform == "youtube_long":
            return common + [
                "Strong pattern interrupt every 15-30 seconds.",
                "Chapters improve watch time and CTR from search.",
                "Ask a question in the first 30s to boost comments.",
                "Custom thumbnail with high contrast + face + 3-4 words max.",
            ]
        if platform == "tiktok":
            return [
                "Hook in first 1 second. Text on screen is almost mandatory.",
                "Post 1-4 times per day if consistent quality is possible.",
                "Reply to comments with videos – massive distribution boost.",
                "Use 3-5 relevant hashtags + 1-2 broader ones.",
            ]
        return common

    def batch_packages(
        self,
        topics: List[str],
        platform: str = "youtube_shorts",
    ) -> List[ContentPackage]:
        return [self.generate_package(t, platform=platform) for t in topics]
