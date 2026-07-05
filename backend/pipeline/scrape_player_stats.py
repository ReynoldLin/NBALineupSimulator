"""
Pipeline step 2: scrape each player's Totals table from basketball-reference
and populate `player_season_stats`. Also verifies/corrects slugs and updates
`Player.positions` and `Player.slug` as it goes.

Run manually (from backend/):
    python -m pipeline.scrape_player_stats

Behaviour:
  - Only processes players who have no rows yet in `player_season_stats`,
    so re-running is safe and picks up where it left off.
  - Caches raw HTML pages to backend/pipeline/cache/ so a re-run after a
    crash doesn't re-fetch already-downloaded pages.
  - Logs any player whose slug can't be verified or corrected to
    backend/pipeline/failed_slugs.txt for manual review.
  - Respects a configurable delay between requests to avoid being blocked
    by basketball-reference.
"""

import logging
import time
import unicodedata
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import Player, PlayerSeasonStats, Team
from pipeline.utils import BBR_TEAM_ABBREV, generate_slug, season_to_decade

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = "https://www.basketball-reference.com"
REQUEST_DELAY = 4.0   # seconds between requests — be polite to bbr
CACHE_DIR = Path(__file__).resolve().parent / "cache"
FAILED_SLUGS_FILE = Path(__file__).resolve().parent / "failed_slugs.txt"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; nba-lineup-project/1.0; personal research tool)"
    )
}

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Manually verified slugs — these players have names with special characters
# that can't be normalized to match basketball-reference. The slug is confirmed
# correct and verification is skipped entirely for these player ids.
# ---------------------------------------------------------------------------
VERIFIED_SLUG_OVERRIDES: dict[int, str] = {
    201600: "asikom01",    # Omer Asik (Ömer Aşık on bbr)
    76901:  "gudmupe01",   # Petur Gudmundsson (Pétur Guðmundsson on bbr)
    202353: "pleisti01",   # Tibor Pleiss
}

# ---------------------------------------------------------------------------
# Text helpers
# ---------------------------------------------------------------------------

def _normalize_name(name: str) -> str:
    """Lowercase, strip accents, and strip periods for name comparison.
    Handles cases like nba_api 'AJ Green' vs bbr 'A.J. Green',
    and accented names like 'Dennis Schröder' vs 'Dennis Schroder'.
    """
    nfkd = unicodedata.normalize("NFKD", name)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.lower().replace(".", "").strip()


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_path(slug: str) -> Path:
    return CACHE_DIR / f"{slug}.html"


def _read_cache(slug: str) -> Optional[str]:
    path = _cache_path(slug)
    if path.exists():
        return path.read_text(encoding="utf-8")
    return None


def _write_cache(slug: str, html: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    _cache_path(slug).write_text(html, encoding="utf-8")


# ---------------------------------------------------------------------------
# HTTP
# ---------------------------------------------------------------------------

def fetch_page(url: str, cache_key: Optional[str] = None) -> Optional[str]:
    """Fetch a URL, using cache if available. Returns HTML string or None on error.

    cache_key: if provided, reads from / writes to cache/{cache_key}.html.
    The delay is applied before every real network request (not cache hits).
    """
    if cache_key:
        cached = _read_cache(cache_key)
        if cached:
            logger.debug("Cache hit: %s", cache_key)
            return cached

    time.sleep(REQUEST_DELAY)
    try:
        response = requests.get(url, headers=HEADERS, timeout=15)
        if response.status_code == 404:
            logger.warning("404: %s", url)
            return None
        if response.status_code != 200:
            logger.warning("HTTP %d: %s", response.status_code, url)
            return None
        # Explicitly decode as utf-8 to handle accented characters
        # (e.g. Schröder). response.text uses requests' auto-detected
        # encoding which can misread utf-8 as latin-1.
        html = response.content.decode("utf-8", errors="replace")
        if cache_key:
            _write_cache(cache_key, html)
        return html
    except requests.RequestException as e:
        logger.error("Request failed for %s: %s", url, e)
        return None


# ---------------------------------------------------------------------------
# Slug verification and fallback
# ---------------------------------------------------------------------------

def _name_from_page(html: str) -> Optional[str]:
    """Extract the player's display name from the JSON-LD script tag on their
    basketball-reference page."""
    import json
    soup = BeautifulSoup(html, "lxml")
    script = soup.find("script", {"type": "application/ld+json"})
    if script:
        try:
            data = json.loads(script.string)
            return data.get("name")
        except (json.JSONDecodeError, AttributeError):
            pass
    return None


def verify_slug(player: Player, slug: str) -> Optional[str]:
    """Fetch the player page for `slug` and confirm the name on the page
    matches player.full_name (case-insensitive).

    Returns the verified slug if it matches, None otherwise.
    """
    url = f"{BASE_URL}/players/{slug[0]}/{slug}.html"
    html = fetch_page(url, cache_key=slug)
    if not html:
        return None

    page_name = _name_from_page(html)
    if page_name and _normalize_name(page_name) == _normalize_name(player.full_name):
        return slug

    logger.info(
        "Slug mismatch for %s (slug=%s, page name=%r)",
        player.full_name, slug, page_name,
    )
    return None


def find_slug_from_index(player: Player) -> Optional[str]:
    """Fallback: fetch basketball-reference's player index page for the first
    letter of the player's last name and scan for a row matching player.full_name.

    Returns the correct slug if found, None otherwise.
    """
    # Extract the last name from full_name ("Kawhi Leonard" -> "Leonard")
    # nba_api gives full_name as "First Last" (or "First Middle Last")
    last_name_initial = player.full_name.split()[-1][0].lower()
    index_url = f"{BASE_URL}/players/{last_name_initial}/"
    cache_key = f"_index_{last_name_initial}"

    html = fetch_page(index_url, cache_key=cache_key)
    if not html:
        return None

    soup = BeautifulSoup(html, "lxml")
    # Each player on the index page is an <a> tag inside a <th> with their
    # name as text, and the href contains the slug.
    for link in soup.select("table#players th[data-stat='player'] a"):
        name = link.get_text(strip=True)
        if _normalize_name(name) == _normalize_name(player.full_name):
            # href looks like "/players/l/leonaka01.html"
            href = link.get("href", "")
            slug = href.split("/")[-1].replace(".html", "")
            logger.info(
                "Found correct slug for %s via index: %s", player.full_name, slug
            )
            return slug

    return None


def _log_failed_slug(player: Player, reason: str) -> None:
    with FAILED_SLUGS_FILE.open("a", encoding="utf-8") as f:
        f.write(f"{player.nba_api_id}\t{player.full_name}\t{player.slug}\t{reason}\n")


# ---------------------------------------------------------------------------
# Team helpers
# ---------------------------------------------------------------------------

def _get_or_create_team(abbrev: str, db: Session, team_cache: dict[str, Team]) -> Optional[Team]:
    """Look up a team by its basketball-reference abbreviation.

    Uses an in-memory cache (team_cache) to avoid repeated DB lookups within
    a single scraper run. Returns None for unknown abbreviations (they get
    logged as warnings and the row is skipped).
    """
    if abbrev in team_cache:
        return team_cache[abbrev]

    # Try DB first (team may have been added by a previous run)
    team = db.query(Team).filter(Team.abbreviation == abbrev).first()
    if not team:
        full_name = BBR_TEAM_ABBREV.get(abbrev)
        if not full_name:
            logger.warning("Unknown team abbreviation: %s — skipping row", abbrev)
            return None
        team = Team(abbreviation=abbrev, full_name=full_name)
        db.add(team)
        db.flush()   # assigns team_id without a full commit

    team_cache[abbrev] = team
    return team


# ---------------------------------------------------------------------------
# Totals table parsing
# ---------------------------------------------------------------------------

def parse_totals_table(
    html: str,
    player: Player,
    team_cache: dict[str, Team],
    db: Session,
) -> list[PlayerSeasonStats]:
    """Parse the Totals table from a player's basketball-reference page.

    Returns a list of PlayerSeasonStats objects (not yet added to the session).
    Skips TOT rows and any rows outside the 1960s-2020s decade range.
    """
    soup = BeautifulSoup(html, "lxml")

    # The totals table id is "totals" on bbr player pages
    table = soup.find("table", {"id": "totals_stats"})
    if not table:
        logger.warning("No totals table found for %s", player.full_name)
        return []

    rows: list[PlayerSeasonStats] = []

    for tr in table.select("tbody tr"):
        # Skip mid-table header rows only. partial_table rows are individual
        # team stints for traded players — we want to keep those.
        if "thead" in tr.get("class", []):
            continue

        def cell(stat: str) -> str:
            # season is in a <th>, all other stats are in <td>
            tag = tr.find(["th", "td"], {"data-stat": stat})
            return tag.get_text(strip=True) if tag else ""

        season_str = cell("year_id")        # e.g. "2009-10"
        team_abbrev = cell("team_name_abbr") # e.g. "SAS"
        position = cell("pos")              # e.g. "PG", "SG-SF"
        awards = cell("awards")             # e.g. "MVP-1,AS" (links stripped by get_text)

        # Skip blank rows, TOT rows, and XTM rows (2TM, 3TM, 4TM etc.) --
        # these are combined total rows for players traded mid-season.
        # We keep the individual team rows instead.
        if not season_str or team_abbrev == "TOT" or (
            len(team_abbrev) == 3 and team_abbrev[1:] == "TM" and team_abbrev[0].isdigit()
        ):
            continue

        # Parse season_start_year from "2009-10" -> 2009
        try:
            season_start_year = int(season_str.split("-")[0])
        except ValueError:
            logger.warning("Could not parse season %r for %s", season_str, player.full_name)
            continue

        decade = season_to_decade(season_start_year)

        # Only keep seasons within our target decades (1960s-2020s)
        if decade not in {1960, 1970, 1980, 1990, 2000, 2010, 2020}:
            continue

        team = _get_or_create_team(team_abbrev, db, team_cache)
        if not team:
            continue

        def int_cell(stat: str) -> int:
            try:
                return int(cell(stat))
            except ValueError:
                return 0

        rows.append(PlayerSeasonStats(
            player_id=player.player_id,
            team_id=team.team_id,
            season_start_year=season_start_year,
            decade=decade,
            position=position,
            awards=awards,
            games_played=int_cell("games"),
            games_started=int_cell("games_started"),
            minutes_played=int_cell("mp"),
            fg=int_cell("fg"),
            fga=int_cell("fga"),
            fg3=int_cell("fg3"),
            fg3a=int_cell("fg3a"),
            ft=int_cell("ft"),
            fta=int_cell("fta"),
            trb=int_cell("trb"),
            ast=int_cell("ast"),
            stl=int_cell("stl"),
            blk=int_cell("blk"),
            tov=int_cell("tov"),
            pts=int_cell("pts"),
        ))

    return rows


# ---------------------------------------------------------------------------
# Per-player orchestration
# ---------------------------------------------------------------------------

def _collect_positions(season_rows: list[PlayerSeasonStats]) -> str:
    """Collect distinct positions across all seasons, preserving order of
    first appearance. e.g. ["PG", "SG-SF", "PG"] -> "PG, SG-SF"
    """
    seen: list[str] = []
    for row in season_rows:
        # A position cell can itself contain multiple (e.g. "SG-SF"),
        # split those out so we deduplicate at the individual position level.
        for pos in row.position.split("-"):
            pos = pos.strip()
            if pos and pos not in seen:
                seen.append(pos)
    return ", ".join(seen)


def scrape_player(player: Player, db: Session, team_cache: dict[str, Team]) -> bool:
    """Scrape one player. Returns True on success, False on failure."""
    slug = player.slug

    # Step 0: check if this player has a manually verified slug override
    if player.nba_api_id in VERIFIED_SLUG_OVERRIDES:
        confirmed_slug = VERIFIED_SLUG_OVERRIDES[player.nba_api_id]
        if confirmed_slug != slug:
            player.slug = confirmed_slug
            slug = confirmed_slug
        logger.info("Using verified slug override for %s: %s", player.full_name, slug)
    else:
        # Step 1: verify the generated slug
        confirmed_slug = verify_slug(player, slug)

        # Step 2: if it didn't match, try the index fallback
        if not confirmed_slug:
            confirmed_slug = find_slug_from_index(player)

    # Step 3: if still nothing, log and give up
    if not confirmed_slug:
        reason = "slug could not be verified or found via index"
        logger.warning("FAILED %s (%s): %s", player.full_name, slug, reason)
        _log_failed_slug(player, reason)
        return False



    # Step 4: fetch the page (may already be cached from verify_slug)
    url = f"{BASE_URL}/players/{slug[0]}/{slug}.html"
    html = fetch_page(url, cache_key=slug)
    if not html:
        reason = "page fetch failed after slug confirmed"
        logger.warning("FAILED %s (%s): %s", player.full_name, slug, reason)
        _log_failed_slug(player, reason)
        return False

    # Step 5: parse the totals table
    season_rows = parse_totals_table(html, player, team_cache, db)

    if not season_rows:
        # Player exists on bbr but has no rows in our target decades —
        # could be a player whose entire career pre-dates the 1960s.
        # Not a failure, just nothing to insert.
        logger.info("No qualifying seasons for %s", player.full_name)
        return True

    # Step 6: insert season rows
    db.add_all(season_rows)

    # Step 7: update player positions across career
    player.positions = _collect_positions(season_rows)

    db.commit()
    logger.info(
        "Scraped %s (%s): %d season rows, positions=%r",
        player.full_name, slug, len(season_rows), player.positions,
    )
    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="Scrape player stats from basketball-reference.")
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only scrape this many players (useful for testing).",
    )
    parser.add_argument(
        "--player",
        type=str,
        default=None,
        help="Scrape a single player by full name e.g. 'Kawhi Leonard'.",
    )
    args = parser.parse_args()

    init_db()
    db = SessionLocal()

    # In-memory team cache shared across all players in this run
    team_cache: dict[str, Team] = {}

    try:
        # Only fetch players who don't already have season rows
        already_scraped_ids = {
            row[0] for row in db.query(PlayerSeasonStats.player_id).distinct()
        }

        query = db.query(Player).filter(Player.player_id.notin_(already_scraped_ids))

        if args.player:
            query = query.filter(Player.full_name == args.player)
        else:
            query = query.order_by(Player.full_name)

        if args.limit:
            query = query.limit(args.limit)

        players_to_scrape = query.all()

        total = len(players_to_scrape)
        logger.info("%d players to scrape", total)

        succeeded, failed = 0, 0
        for i, player in enumerate(players_to_scrape, start=1):
            logger.info("[%d/%d] Scraping %s", i, total, player.full_name)
            ok = scrape_player(player, db, team_cache)
            if ok:
                succeeded += 1
            else:
                failed += 1

        logger.info("Done. succeeded=%d failed=%d", succeeded, failed)
        if failed:
            logger.info("Failed players logged to %s", FAILED_SLUGS_FILE)

    finally:
        db.close()


if __name__ == "__main__":
    main()