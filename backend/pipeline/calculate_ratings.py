"""
Pipeline step 4: calculate player ratings for each row in
player_team_decade_stats.

Run manually (from backend/):
    python -m pipeline.calculate_ratings

Ratings (all scaled 25-99):
    scoring_rating    : pts_per_game, percentile within decade
    shooting_rating   : fg3_pct, percentile within decade (0 if total_fg3a == 0)
    playmaking_rating : ast_per_game, tov_per_game, percentile within decade
    rebounding_rating : reb_per_game, percentile within decade
    defense_rating    : stl_per_game, blk_per_game + awards bonus, percentile within decade

All ratings are:
    1. Computed as percentile rank within the same decade
    2. Weighted by games played (min 41 games for full weight)
    3. Boosted by awards where relevant
    4. Scaled to 25-99 range
"""

import logging
import re
import math
from collections import defaultdict

from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import PlayerTeamDecadeStats

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

RATING_MIN = 25.0
RATING_MAX = 99.0

# Games played weight — full weight at 50 games
GAMES_WEIGHT_THRESHOLD = 50

# Award weights — used to boost relevant ratings
AWARD_WEIGHTS = {
    "DPOY": {1: 10, 2: 8, 3: 5},
    "DEF":  {1: 5, 2: 3},
    "MVP":  {1: 10, 2: 5, 3: 5, 4: 5, 5: 5},
    "NBA":  {1: 7, 2: 5, 3: 3},
    "AS":   {None: 3},
    "ROY":  {None: 2},
}


# ---------------------------------------------------------------------------
# Award parsing
# ---------------------------------------------------------------------------

def parse_awards(awards_str: str) -> dict[str, list[int]]:
    """Parse awards string into a dict of {award_type: [ranks]}.

    e.g. "MVP-1 | AS | DEF2 | MVP-3" ->
         {"MVP": [1, 3], "AS": [None], "DEF": [2]}
    """
    result: dict[str, list] = defaultdict(list)
    if not awards_str:
        return result

    for segment in awards_str.split(" | "):
        for token in segment.split(","):
            token = token.strip()
            if not token:
                continue
            # Match e.g. "MVP-1", "DEF2", "NBA1", "AS", "ROY-4"
            match = re.match(r"([A-Z]+)[-]?(\d+)?", token)
            if match:
                award_type = match.group(1)
                rank = int(match.group(2)) if match.group(2) else None
                result[award_type].append(rank)

    return dict(result)


def get_award_boost(awards_str: str, award_types: list[str]) -> float:
    """Calculate total award boost for given award types."""
    parsed = parse_awards(awards_str)
    total = 0.0

    for award_type in award_types:
        if award_type not in parsed or award_type not in AWARD_WEIGHTS:
            continue
        weight_map = AWARD_WEIGHTS[award_type]
        
        # Find the max explicitly listed numeric rank
        numeric_keys = [k for k in weight_map if k is not None]
        max_explicit_rank = max(numeric_keys) if numeric_keys else None

        for rank in parsed[award_type]:
            if rank in weight_map:
                total += weight_map[rank]
            elif None in weight_map:
                # Award has no rank (e.g. AS, ROY)
                total += weight_map[None]
            elif max_explicit_rank is not None and rank is not None and rank > max_explicit_rank:
                # Rank beyond explicitly listed ones gets a small default
                total += 1.0

    return total


# ---------------------------------------------------------------------------
# Games played weight
# ---------------------------------------------------------------------------

def games_weight(games_played: int) -> float:
    """Scale 0-1 based on games played. Full weight at GAMES_WEIGHT_THRESHOLD+."""
    if games_played <= 0:
        return 0.0
    return min(games_played / GAMES_WEIGHT_THRESHOLD, 1.0)


# ---------------------------------------------------------------------------
# Scaling
# ---------------------------------------------------------------------------

def scale_to_range(value: float, min_val: float, max_val: float) -> float:
    """Scale a value from [min_val, max_val] to [RATING_MIN, RATING_MAX]."""
    if max_val == min_val:
        return RATING_MIN
    normalized = (value - min_val) / (max_val - min_val)
    return RATING_MIN + normalized * (RATING_MAX - RATING_MIN)


def percentile_rank(value: float, all_values: list[float]) -> float:
    """Return percentile rank of value in all_values (0.0 - 1.0)."""
    if not all_values:
        return 0.0
    below = sum(1 for v in all_values if v < value)
    return below / len(all_values)

def curve_percentile(pct: float, k: float = 12, inflection: float = 0.99) -> float:
    """Sigmoid curve normalised so pct=0 maps to 0 and pct=1 maps to 1."""
    raw = 1 / (1 + math.exp(-k * (pct - inflection)))
    min_raw = 1 / (1 + math.exp(-k * (0.0 - inflection)))  # value at pct=0
    max_raw = 1 / (1 + math.exp(-k * (1.0 - inflection)))  # value at pct=1
    return (raw - min_raw) / (max_raw - min_raw)

# ---------------------------------------------------------------------------
# Rating calculations
# ---------------------------------------------------------------------------

def compute_raw_scores(rows: list[PlayerTeamDecadeStats]) -> dict[int, dict[str, float]]:
    """Compute raw scores for each player row before scaling."""
    raw: dict[int, dict[str, float]] = {}

    for row in rows:
        gw = games_weight(row.games_played)

        # Scoring: pts_per_game weighted by games
        scoring_raw = row.pts_per_game * gw

        # Shooting: fg3_pct weighted by games, 0 if no 3PA
        if row.total_fg3a == 0:
            if row.decade in (1960, 1970):
                # Linear rescale: 50% FT -> 25% 3P equiv, 95% FT -> 45% 3P equiv
                ft_pct = row.ft_pct
                three_p_equivalent = 0.25 + (ft_pct - 0.50) / (0.90 - 0.50) * (0.45 - 0.25)
                three_p_equivalent = max(0.25, min(0.45, three_p_equivalent))  # clamp to range
                shooting_raw = three_p_equivalent * gw
            else:
                shooting_raw = 0.0
        else:
            shooting_raw = row.fg3_pct * math.log1p(row.total_fg3a/row.games_played) * gw

        # Playmaking: ast_per_game weighted by games
        playmaking_raw = row.ast_per_game * gw

        # Rebounding: reb_per_game weighted by games
        rebounding_raw = row.reb_per_game * gw

        award_boost = get_award_boost(row.awards, ["DPOY", "DEF"]) * gw
        defense_raw = (row.dws_per_season + award_boost) * gw

        raw[row.id] = {
            "scoring": scoring_raw,
            "shooting": shooting_raw,
            "playmaking": playmaking_raw,
            "rebounding": rebounding_raw,
            "defense": defense_raw,
        }

    return raw


def scale_ratings(
    rows: list[PlayerTeamDecadeStats],
    raw: dict[int, dict[str, float]],
) -> dict[int, dict[str, float]]:


    rating_names = ["scoring", "shooting", "playmaking", "rebounding", "defense"]
    all_raw_values: dict[str, list[float]] = {r: [] for r in rating_names}

    for row_id, scores in raw.items():
        for name in rating_names:
            all_raw_values[name].append(scores[name])

    scaled: dict[int, dict[str, float]] = {}
    for row in rows:
        scores = raw[row.id]
        scaled[row.id] = {}
        for name in rating_names:
            pct = percentile_rank(scores[name], all_raw_values[name])

            if name == "shooting":
                curved = curve_percentile(min(pct, 1.0), k=6, inflection=0.90)
            else:
                curved = curve_percentile(min(pct, 1.0))
            rating = RATING_MIN + curved * (RATING_MAX - RATING_MIN)
            scaled[row.id][name] = round(rating, 1)

    return scaled


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    init_db()
    db = SessionLocal()

    try:
        all_rows = db.query(PlayerTeamDecadeStats).all()
        logger.info("Loaded %d rows from player_team_decade_stats", len(all_rows))

        # Group by decade so percentile ranks are relative within each decade
        by_decade: dict[int, list[PlayerTeamDecadeStats]] = defaultdict(list)
        for row in all_rows:
            by_decade[row.decade].append(row)

        total_updated = 0

        for decade, rows in sorted(by_decade.items()):
            logger.info("Computing ratings for %ds (%d rows)...", decade, len(rows))

            raw = compute_raw_scores(rows)
            scaled = scale_ratings(rows, raw)

            for row in rows:
                ratings = scaled[row.id]
                row.scoring_rating = ratings["scoring"]
                row.shooting_rating = ratings["shooting"]
                row.playmaking_rating = ratings["playmaking"]
                row.rebounding_rating = ratings["rebounding"]
                row.defense_rating = ratings["defense"]
                total_updated += 1

            db.commit()
            logger.info("  Done %ds.", decade)

        logger.info("Ratings calculated for %d rows.", total_updated)

    finally:
        db.close()


if __name__ == "__main__":
    main()