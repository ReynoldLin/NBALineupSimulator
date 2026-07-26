"""
Pipeline utility: extract DWS (Defensive Win Shares) from cached HTML files
and update player_season_stats.

Run manually (from backend/):
    python -m pipeline.extract_dws

Reads from pipeline/cache/*.html — no network calls needed.
Only processes season rows where dws == 0.0.
"""

import logging
import argparse
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import Player, PlayerSeasonStats
from pipeline.utils import BBR_TEAM_ABBREV

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

CACHE_DIR = Path(__file__).resolve().parent / "cache"

# Maps team_id to all historical bbr abbreviations that were merged into it
MERGED_ABBREVS: dict[int, set[str]] = {
    1610612737: {"STL", "ATL"},
    1610612787: {"NJN", "NYN", "BRK"},
    1610612770: {"CHA", "CHH", "CHO"},
    1610612744: {"PHW", "SFW", "GSW"},
    1610612745: {"SDR", "HOU"},
    1610612746: {"BUF", "SDC", "LAC"},
    1610612747: {"MNL", "LAL"},
    1610612763: {"VAN", "MEM"},
    1610612740: {"NOH", "NOK", "NOP"},
    1610612760: {"SEA", "OKC"},
    1610612755: {"SYR", "PHI"},
    1610612758: {"CIN", "KCK", "KCO", "SAC"},
    1610612762: {"NOJ", "UTA"},
    1610612764: {"CHP", "CHZ", "BAL", "CAP", "WSB", "WAS"},
}

def build_team_abbrev_lookup(db: Session) -> dict[int, set[str]]:
    """Build a mapping of team_id to all possible bbr abbreviations."""
    from app.models import Team
    teams = db.query(Team).all()
    
    # Start with current abbreviations
    id_to_abbrevs: dict[int, set[str]] = {
        t.team_id: {t.abbreviation} for t in teams
    }
    
    # Add all historical merged abbreviations
    for team_id, abbrevs in MERGED_ABBREVS.items():
        if team_id in id_to_abbrevs:
            id_to_abbrevs[team_id].update(abbrevs)
        else:
            id_to_abbrevs[team_id] = abbrevs
    
    return id_to_abbrevs

def parse_advanced_table(html: str) -> dict[tuple[int, str], float]:
    """Parse the Advanced table from a player's cached HTML page.
    
    Returns a dict of {(season_start_year, team_abbrev): dws}
    Skips TOT/2TM/3TM rows.
    """
    soup = BeautifulSoup(html, "lxml")

    # Find the advanced table directly
    table = soup.find("table", {"id": "advanced"})
    if not table:
        return {}

    results = {}

    for tr in table.select("tbody tr"):
        # Skip header rows
        if "thead" in tr.get("class", []):
            continue

        def cell(stat: str) -> str:
            tag = tr.find(["th", "td"], {"data-stat": stat})
            return tag.get_text(strip=True) if tag else ""

        season_str = cell("year_id")        # e.g. "2009-10"
        team_abbrev = cell("team_name_abbr") # e.g. "SAS"
        dws_str = cell("dws")               # e.g. "4.6"

        if not season_str or not team_abbrev:
            continue

        # Skip combined rows
        if team_abbrev == "TOT" or (
            len(team_abbrev) == 3
            and team_abbrev[1:] == "TM"
            and team_abbrev[0].isdigit()
        ):
            continue

        # Parse season start year
        try:
            season_start_year = int(season_str.split("-")[0])
        except ValueError:
            continue

        # Parse DWS
        try:
            dws = float(dws_str) if dws_str else 0.0
        except ValueError:
            dws = 0.0

        results[(season_start_year, team_abbrev)] = dws

    return results


def main() -> None:
    init_db()
    db = SessionLocal()

    abbrev_lookup = build_team_abbrev_lookup(db)

    parser = argparse.ArgumentParser()
    parser.add_argument("--player-id", type=int, default=None)
    args = parser.parse_args()

    try:
        # Get all players who have season stats
        query = db.query(Player)
        if args.player_id:
            query = query.filter(Player.player_id == args.player_id)
        players = query.all()
        logger.info("Processing %d players", len(players))

        updated, missing_cache, no_table = 0, 0, 0

        for i, player in enumerate(players):
            cache_file = CACHE_DIR / f"{player.slug}.html"

            if not cache_file.exists():
                missing_cache += 1
                continue

            html = cache_file.read_text(encoding="utf-8", errors="replace")
            dws_data = parse_advanced_table(html)

            if not dws_data:
                no_table += 1
                continue

            # Update matching season rows
            season_rows = (
                db.query(PlayerSeasonStats)
                .filter(PlayerSeasonStats.player_id == player.player_id)
                .all()
            )

            for row in season_rows:
                # Look up team abbreviation for this row
                team = row.team
                if not team:
                    continue

                valid_abbrevs = abbrev_lookup.get(row.team_id, set())
                key = next(
                    ((row.season_start_year, abbrev) for abbrev in valid_abbrevs
                    if (row.season_start_year, abbrev) in dws_data),
                    None
                )
                if key:
                    row.dws = dws_data[key]
                    updated += 1

            if (i + 1) % 200 == 0:
                db.commit()
                logger.info(
                    "Progress: %d/%d — updated=%d missing_cache=%d no_table=%d",
                    i + 1, len(players), updated, missing_cache, no_table,
                )

        db.commit()
        logger.info(
            "Done. updated=%d missing_cache=%d no_table=%d",
            updated, missing_cache, no_table,
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()