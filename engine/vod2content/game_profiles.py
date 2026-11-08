"""
Game-specific highlight profiles.
Each profile tunes audio analysis, segment lengths, and scoring
to what "exciting" means for that game/genre.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any


@dataclass
class GameProfile:
    id: str
    name: str
    description: str
    # Audio analysis tuning
    window_ms: int = 400                 # analysis window
    top_percentile: float = 78.0         # energy threshold
    min_segment: float = 12.0
    max_segment: float = 55.0
    ideal_segment: float = 28.0
    # Spectral emphasis (relative weights for frequency bands)
    # Bands: sub(0-150), low(150-400), mid(400-2000), high(2000-6000), presence(6000+)
    band_weights: List[float] = field(default_factory=lambda: [1.0, 1.0, 1.0, 1.0, 1.0])
    # Prefer sustained energy vs sharp transients
    prefer_sustained: bool = False       # True = racing/continuous action
    transient_boost: float = 1.0         # >1 favors gunshots, impacts, crashes
    # How much to expand around a peak
    pre_roll: float = 0.35               # fraction of segment before peak
    post_roll: float = 0.65
    # Scoring multipliers
    score_weights: Dict[str, float] = field(default_factory=lambda: {
        "energy": 1.0,
        "transient": 0.6,
        "sustained": 0.4,
        "spectral_match": 0.8,
    })
    # Content packaging hints
    default_topic: str = "highlights"
    title_keywords: List[str] = field(default_factory=list)
    hook_styles: List[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Built-in profiles
# ---------------------------------------------------------------------------

PROFILES: Dict[str, GameProfile] = {}

def _register(p: GameProfile):
    PROFILES[p.id] = p
    # also allow common aliases
    for alias in [p.id, p.name.lower().replace(" ", ""), p.name.lower().replace(" ", "_")]:
        PROFILES[alias] = p


# Generic fallback
_register(GameProfile(
    id="generic",
    name="Generic / Unknown",
    description="Balanced audio-peak detection for any content",
    window_ms=450,
    top_percentile=75.0,
    min_segment=12.0,
    max_segment=55.0,
    ideal_segment=28.0,
    band_weights=[1.0, 1.0, 1.2, 1.1, 0.9],
    prefer_sustained=False,
    transient_boost=1.2,
    default_topic="highlights",
    title_keywords=["epic", "insane", "best moments"],
    hook_styles=["Wait for it...", "This is crazy", "You won't believe this"],
))


# iRacing / racing sims (Assetto Corsa, rFactor, Le Mans Ultimate, etc.)
_register(GameProfile(
    id="iracing",
    name="iRacing / Racing Sims",
    description="Emphasizes engine roar, continuous high energy, crashes, overtakes, and finish-line moments",
    window_ms=350,                       # faster reaction to RPM changes
    top_percentile=72.0,                 # slightly more sensitive (engines are loud)
    min_segment=15.0,
    max_segment=50.0,
    ideal_segment=32.0,                  # racing moments benefit from a bit more context
    # Strong low + low-mid (engine), some high for tire squeal / impacts
    band_weights=[1.4, 1.5, 1.1, 0.9, 0.7],
    prefer_sustained=True,               # continuous high energy is good
    transient_boost=1.8,                 # crashes and big hits still matter a lot
    pre_roll=0.40,
    post_roll=0.60,
    score_weights={
        "energy": 1.0,
        "transient": 0.9,                # crashes are gold
        "sustained": 1.1,                # long high-RPM sections score well
        "spectral_match": 1.0,
    },
    default_topic="iRacing",
    title_keywords=["iRacing", "crash", "overtake", "pole", "win", "battle", "last lap"],
    hook_styles=[
        "The last lap battle was insane",
        "This crash changed everything",
        "Closest overtake of the season",
        "From P12 to the win",
        "Engine is screaming",
    ],
))


# Escape from Tarkov / hardcore extraction / tactical shooters
_register(GameProfile(
    id="tarkov",
    name="Escape from Tarkov",
    description="Favors gunfights, explosions, close-quarters panic, successful extractions, and high-tension moments",
    window_ms=300,                       # capture short bursts of fire
    top_percentile=80.0,                 # only the really loud/intense bits
    min_segment=10.0,
    max_segment=45.0,
    ideal_segment=22.0,                  # Tarkov fights are often short & chaotic
    # Gunshots & voices live in mid-high; explosions have low end too
    band_weights=[0.9, 1.0, 1.3, 1.6, 1.4],
    prefer_sustained=False,
    transient_boost=2.2,                 # gunshots and nades are sharp transients
    pre_roll=0.25,                       # less pre-roll – fights start suddenly
    post_roll=0.75,                      # more post so you see the outcome
    score_weights={
        "energy": 0.9,
        "transient": 1.4,
        "sustained": 0.6,                # prolonged silence is normal; short intense bursts win
        "spectral_match": 1.2,
    },
    default_topic="Escape from Tarkov",
    title_keywords=["Tarkov", "raid", "extract", "clutch", "headshot", "ammo", "boss", "labs"],
    hook_styles=[
        "One magazine left...",
        "They had no idea I was here",
        "Extract is right there",
        "This fight was disgusting",
        "Full kit vs pistols",
        "The scav ran into the wrong PMC",
    ],
))


# Additional useful profiles
_register(GameProfile(
    id="fps",
    name="Competitive FPS (CS2, Valorant, CoD, Apex)",
    description="Gunfights, clutches, aces, and high-kill moments",
    window_ms=280,
    top_percentile=79.0,
    min_segment=9.0,
    max_segment=40.0,
    ideal_segment=20.0,
    band_weights=[0.8, 0.9, 1.2, 1.7, 1.5],
    prefer_sustained=False,
    transient_boost=2.0,
    pre_roll=0.20,
    post_roll=0.80,
    default_topic="FPS highlights",
    title_keywords=["clutch", "ace", "1v5", "headshot", "eco round"],
    hook_styles=["1v4 clutch", "They never saw it coming", "Full buy vs eco"],
))

_register(GameProfile(
    id="battle_royale",
    name="Battle Royale (Warzone, Fortnite, PUBG)",
    description="End-game circles, big team fights, final zone, high-kill games",
    window_ms=350,
    top_percentile=76.0,
    min_segment=12.0,
    max_segment=50.0,
    ideal_segment=28.0,
    band_weights=[1.0, 1.1, 1.3, 1.4, 1.2],
    prefer_sustained=False,
    transient_boost=1.7,
    default_topic="Battle Royale",
    title_keywords=["final circle", "20 bomb", "loadout", "gulag", "win"],
    hook_styles=["Final circle was chaos", "This loadout is broken", "From the gulag to the win"],
))

_register(GameProfile(
    id="mmo_rpg",
    name="MMO / RPG / Story (WoW, FFXIV, Elden Ring, etc.)",
    description="Boss fights, big pulls, cinematic moments, rare drops",
    window_ms=500,
    top_percentile=70.0,
    min_segment=18.0,
    max_segment=60.0,
    ideal_segment=35.0,
    band_weights=[1.1, 1.2, 1.3, 1.1, 0.9],
    prefer_sustained=True,
    transient_boost=1.3,
    default_topic="RPG highlights",
    title_keywords=["boss", "world first", "legendary", "cutscene", "pull"],
    hook_styles=["The mechanic that wiped us", "This drop rate is criminal", "Phase 3 begins"],
))

_register(GameProfile(
    id="sports",
    name="Sports Games (FIFA, NBA2K, Rocket League, etc.)",
    description="Goals, saves, overtime, comebacks",
    window_ms=300,
    top_percentile=77.0,
    min_segment=8.0,
    max_segment=35.0,
    ideal_segment=18.0,
    band_weights=[1.0, 1.1, 1.2, 1.3, 1.1],
    prefer_sustained=False,
    transient_boost=1.9,
    default_topic="Sports highlights",
    title_keywords=["goal", "buzzer beater", "overtime", "comeback", "save"],
    hook_styles=["Last second", "The comeback is real", "What a save"],
))


def get_profile(game: str) -> GameProfile:
    """Lookup profile by id or name (case-insensitive). Falls back to generic."""
    key = game.lower().strip().replace(" ", "").replace("-", "").replace("_", "")
    # direct
    if game.lower() in PROFILES:
        return PROFILES[game.lower()]
    # fuzzy-ish
    for pid, p in PROFILES.items():
        if key in pid.replace("_", "") or key in p.name.lower().replace(" ", ""):
            return p
    # common aliases
    aliases = {
        "racing": "iracing",
        "race": "iracing",
        "simracing": "iracing",
        "assetto": "iracing",
        "acc": "iracing",
        "eft": "tarkov",
        "escapefromtarkov": "tarkov",
        "cs2": "fps",
        "csgo": "fps",
        "valorant": "fps",
        "cod": "fps",
        "warzone": "battle_royale",
        "fortnite": "battle_royale",
        "apex": "fps",
        "wow": "mmo_rpg",
        "ffxiv": "mmo_rpg",
        "eldenring": "mmo_rpg",
    }
    if key in aliases:
        return PROFILES[aliases[key]]
    return PROFILES["generic"]


def list_profiles() -> List[Dict[str, str]]:
    seen = set()
    result = []
    for p in PROFILES.values():
        if p.id not in seen:
            seen.add(p.id)
            result.append({"id": p.id, "name": p.name, "description": p.description})
    return result
