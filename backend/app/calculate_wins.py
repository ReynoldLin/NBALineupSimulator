"""
Win calculation for a completed 10-man lineup.

The formula is broken into tunable sections:
    1. Individual player ratings (from player_team_decade_stats)
    2. Pair complementarity (backcourt PG+SG, bigs PF+C)
    3. Team coverage (how well the 5 categories are covered)
    4. Bench complementarity (does bench cover starter weaknesses)
    5. Final score mapped to 0-82 wins

All tunable constants are at the top of this file.
"""

from dataclasses import dataclass
from typing import Optional
import math

# ---------------------------------------------------------------------------
# Tunable constants
# ---------------------------------------------------------------------------

# Starter vs bench weight (must sum to 1.0)
STARTER_WEIGHT = 0.70
BENCH_WEIGHT = 0.30

# Coverage threshold — sum of two players' ratings to "cover" a category
PAIR_COVERAGE_THRESHOLD = 150

# Team coverage threshold — group average to "cover" a category
TEAM_COVERAGE_THRESHOLD = 60

# Starter weakness threshold — if starter group average is below this,
# the bench should cover it
STARTER_WEAKNESS_THRESHOLD = 55

# Bench coverage bonus — awarded per category where bench covers a starter weakness
BENCH_COVERAGE_BONUS = 5.0

# Synergy bonus — awarded when all 5 categories are covered by the full team
FULL_COVERAGE_BONUS = 15.0

# Category weights (must sum to 1.0) — all equal for now
CATEGORY_WEIGHTS = {
    "scoring":    0.20,
    "shooting":   0.20,
    "playmaking": 0.20,
    "defense":    0.20,
    "rebounding": 0.20,
}

# Rating floor/ceiling — clamp individual ratings to this range
RATING_MIN = 25.0
RATING_MAX = 99.0

# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class PlayerRatings:
    """Ratings for one player in the lineup."""
    player_id: int
    full_name: str
    position: str        # "PG", "SG", "SF", "PF", "C"
    is_starter: bool
    scoring: float
    shooting: float
    playmaking: float
    defense: float
    rebounding: float

    def get(self, category: str) -> float:
        return getattr(self, category, 0.0)


@dataclass
class LineupResult:
    """Full breakdown of the win calculation."""
    wins: int
    record: str          # e.g. "67-15"
    
    # Score components (all 0-100)
    starter_score: float
    bench_score: float
    backcourt_score: float
    frontcourt_score: float
    coverage_score: float
    bench_coverage_score: float
    
    # Category coverage flags
    covered_categories: list[str]
    starter_weaknesses: list[str]
    bench_covers: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clamp(value: float, min_val: float = RATING_MIN, max_val: float = RATING_MAX) -> float:
    return max(min_val, min(max_val, value))


def average_rating(players: list[PlayerRatings], category: str) -> float:
    """Average rating for a category across a group of players."""
    if not players:
        return 0.0
    return sum(p.get(category) for p in players) / len(players)


def weighted_player_score(player: PlayerRatings) -> float:
    """Single composite score for one player, weighted by category."""
    return sum(
        player.get(cat) * weight
        for cat, weight in CATEGORY_WEIGHTS.items()
    )


def pair_category_score(p1: PlayerRatings, p2: PlayerRatings, category: str) -> float:
    """Combined score for a pair in one category."""
    return p1.get(category) + p2.get(category)


def is_pair_covered(p1: PlayerRatings, p2: PlayerRatings, category: str) -> bool:
    """True if a pair covers a category (sum >= threshold)."""
    return pair_category_score(p1, p2, category) >= PAIR_COVERAGE_THRESHOLD

def curve_wins(normalised: float, k: float = 12, inflection: float = 0.99) -> float:
    """Apply sigmoid curve to normalised score (0-1).
    Normalised so 0 always maps to 0 and 1 always maps to 1.
    
    k: steepness of curve — higher = harder to get top scores
    inflection: point where curve transitions — higher = need to be more elite
    """
    raw = 1 / (1 + math.exp(-k * (normalised - inflection)))
    min_raw = 1 / (1 + math.exp(-k * (0.0 - inflection)))
    max_raw = 1 / (1 + math.exp(-k * (1.0 - inflection)))
    return (raw - min_raw) / (max_raw - min_raw)

# ---------------------------------------------------------------------------
# Pair complementarity (backcourt PG+SG, bigs PF+C)
# ---------------------------------------------------------------------------

def score_pair(
    p1: PlayerRatings,
    p2: PlayerRatings,
    category_weights: dict[str, float] = CATEGORY_WEIGHTS,
) -> tuple[float, list[str]]:
    """Score a position pair (backcourt or frontcourt).
        
        Returns:
            - score: 0-100 representing how well the pair covers all 5 categories
            - covered: list of category names that are covered
        
        A category is covered if the sum of both players' ratings >= PAIR_COVERAGE_THRESHOLD.
        The score is the proportion of categories covered, scaled to 0-100,
        plus a bonus for each category that significantly exceeds the threshold.
    """
    covered = []
    total_score = 0.0

    for category, weight in category_weights.items():
        combined = pair_category_score(p1, p2, category)
        if combined >= PAIR_COVERAGE_THRESHOLD:
            covered.append(category)
            category_score = 100.0
            excess = combined - PAIR_COVERAGE_THRESHOLD
            bonus = min(excess * 0.1, 10.0)
            category_score += bonus
        else:
            category_score = (combined / PAIR_COVERAGE_THRESHOLD) * 100.0
        total_score += category_score * weight

    return total_score, covered
 
 
def score_backcourt(pg: PlayerRatings, sg: PlayerRatings) -> tuple[float, list[str]]:
    return score_pair(pg, sg, BACKCOURT_CATEGORY_WEIGHTS)

def score_frontcourt(pf: PlayerRatings, c: PlayerRatings) -> tuple[float, list[str]]:
    return score_pair(pf, c, FRONTCOURT_CATEGORY_WEIGHTS)
 
def score_sf(sf: PlayerRatings) -> float:
    """SF contributes their weighted composite score directly, no pair check."""
    return weighted_player_score(sf)

# ---------------------------------------------------------------------------
# Team coverage
# ---------------------------------------------------------------------------
 
def score_team_coverage(starters: list[PlayerRatings]) -> tuple[float, list[str], list[str]]:
    """Check how well the 5 starters cover all 5 categories as a group.
 
    Returns:
        - score: 0-100 coverage score
        - covered: list of categories where starter group average >= TEAM_COVERAGE_THRESHOLD
        - weaknesses: list of categories where starter group average < STARTER_WEAKNESS_THRESHOLD
    """
    covered = []
    weaknesses = []
    total_score = 0.0
 
    for category, weight in CATEGORY_WEIGHTS.items():
        avg = average_rating(starters, category)
 
        if avg >= TEAM_COVERAGE_THRESHOLD:
            covered.append(category)
            # Bonus for exceeding threshold
            excess = avg - TEAM_COVERAGE_THRESHOLD
            category_score = min(100.0 + (excess * 0.5), 110.0)
        else:
            # Partial credit
            category_score = (avg / TEAM_COVERAGE_THRESHOLD) * 100.0
 
        if avg < STARTER_WEAKNESS_THRESHOLD:
            weaknesses.append(category)
 
        total_score += category_score * weight
 
    # Full coverage bonus — all 5 categories covered
    if len(covered) == 5:
        total_score = min(total_score + FULL_COVERAGE_BONUS, 110.0)
 
    return total_score, covered, weaknesses

# ---------------------------------------------------------------------------
# Bench complementarity
# ---------------------------------------------------------------------------
 
def score_bench_coverage(
    bench: list[PlayerRatings],
    starter_weaknesses: list[str],
) -> tuple[float, list[str]]:
    """Score how well the bench covers starter weaknesses.
 
    For each starter weakness, check if the bench group average for that
    category exceeds TEAM_COVERAGE_THRESHOLD. If so, award BENCH_COVERAGE_BONUS.
 
    Also scores the bench as a group independently of starter weaknesses,
    so a strong bench is always rewarded even if starters have no weaknesses.
 
    Returns:
        - score: 0-100 bench score
        - covers: list of starter weakness categories the bench covers
    """
    covers = []
    total_score = 0.0
 
    for category, weight in CATEGORY_WEIGHTS.items():
        bench_avg = average_rating(bench, category)
 
        # Base bench score for this category
        if bench_avg >= TEAM_COVERAGE_THRESHOLD:
            category_score = 100.0
            excess = bench_avg - TEAM_COVERAGE_THRESHOLD
            category_score = min(100.0 + (excess * 0.5), 110.0)
        else:
            category_score = (bench_avg / TEAM_COVERAGE_THRESHOLD) * 100.0
 
        # Bonus if bench covers a starter weakness in this category
        if category in starter_weaknesses and bench_avg >= TEAM_COVERAGE_THRESHOLD:
            covers.append(category)
            category_score += BENCH_COVERAGE_BONUS
 
        total_score += category_score * weight
 
    # Bonus if bench covers all starter weaknesses
    if starter_weaknesses and len(covers) == len(starter_weaknesses):
        total_score = min(total_score + FULL_COVERAGE_BONUS, 120.0)
 
    return total_score, covers

# ---------------------------------------------------------------------------
# Final score and win calculation
# ---------------------------------------------------------------------------
 
# Component weights for the final score
# Pair complementarity is the main basis as agreed
SCORE_WEIGHTS = {
    "backcourt":      0.25,  # PG+SG pair
    "frontcourt":     0.25,  # PF+C pair
    "sf":             0.10,  # SF standalone
    "team_coverage":  0.20,  # starter group coverage
    "bench_coverage": 0.20,  # bench score + weakness coverage
}

BACKCOURT_CATEGORY_WEIGHTS = {
    "scoring":    0.20,
    "shooting":   0.25,
    "playmaking": 0.25,
    "defense":    0.25,
    "rebounding": 0.05,
}

FRONTCOURT_CATEGORY_WEIGHTS = {
    "scoring":    0.25,
    "shooting":   0.05,
    "playmaking": 0.15,
    "defense":    0.25,
    "rebounding": 0.30,
}
 
# Maximum possible raw score — used to normalise to 0-82
# Theoretical max: each component scores 110-120
MAX_POSSIBLE_SCORE = (
    100.0 * SCORE_WEIGHTS["backcourt"] +
    100.0 * SCORE_WEIGHTS["frontcourt"] +
    99.0  * SCORE_WEIGHTS["sf"] +
    110.0 * SCORE_WEIGHTS["team_coverage"] +
    100.0 * SCORE_WEIGHTS["bench_coverage"]
)

# Minimum possible raw score — derived from all-25.0 lineup test
# Backcourt=33.3, Frontcourt=33.3, SF=25.0, Coverage=41.7, Bench=41.7
MIN_POSSIBLE_SCORE = (
    33.3 * SCORE_WEIGHTS["backcourt"] +
    33.3 * SCORE_WEIGHTS["frontcourt"] +
    25.0 * SCORE_WEIGHTS["sf"] +
    41.7 * SCORE_WEIGHTS["team_coverage"] +
    41.7 * SCORE_WEIGHTS["bench_coverage"]
)
 
 
def calculate_wins(players: list[PlayerRatings]) -> LineupResult:
    """Calculate the season record for a completed 10-man lineup.
 
    Args:
        players: list of 10 PlayerRatings, must include all 5 positions
                 for both starters and bench.
 
    Returns:
        LineupResult with wins, record string and full score breakdown.
    """
    # Split into starters and bench
    starters = [p for p in players if p.is_starter]
    bench = [p for p in players if not p.is_starter]
 
    # Extract by position
    def get(group: list[PlayerRatings], pos: str) -> PlayerRatings:
        return next(p for p in group if p.position == pos)
 
    starter_pg = get(starters, "PG")
    starter_sg = get(starters, "SG")
    starter_sf = get(starters, "SF")
    starter_pf = get(starters, "PF")
    starter_c  = get(starters, "C")
 
    # pair complementarity
    backcourt_score, backcourt_covered = score_backcourt(starter_pg, starter_sg)
    frontcourt_score, frontcourt_covered = score_frontcourt(starter_pf, starter_c)
    sf_score = score_sf(starter_sf)
 
    # team coverage
    coverage_score, covered_categories, starter_weaknesses = score_team_coverage(starters)
 
    # bench coverage
    bench_score, bench_covers = score_bench_coverage(bench, starter_weaknesses)
 
    # weighted final score
    raw_score = (
        backcourt_score  * SCORE_WEIGHTS["backcourt"] +
        frontcourt_score * SCORE_WEIGHTS["frontcourt"] +
        sf_score         * SCORE_WEIGHTS["sf"] +
        coverage_score   * SCORE_WEIGHTS["team_coverage"] +
        bench_score      * SCORE_WEIGHTS["bench_coverage"]
    )
 
    # Normalise to 0-82
    normalised = (raw_score - MIN_POSSIBLE_SCORE) / (MAX_POSSIBLE_SCORE - MIN_POSSIBLE_SCORE)
    curved = curve_wins(normalised)
    wins = int(round(curved * 82))
    wins = max(0, min(82, wins))

    record = f"{wins}-{82 - wins}"
 
    return LineupResult(
        wins=wins,
        record=record,
        starter_score=round(sum(weighted_player_score(p) for p in starters) / 5, 1),
        bench_score=round(sum(weighted_player_score(p) for p in bench) / 5, 1),
        backcourt_score=round(backcourt_score, 1),
        frontcourt_score=round(frontcourt_score, 1),
        coverage_score=round(coverage_score, 1),
        bench_coverage_score=round(bench_score, 1),
        covered_categories=covered_categories,
        starter_weaknesses=starter_weaknesses,
        bench_covers=bench_covers,
    )