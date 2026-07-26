"""
Pipeline step 3: aggregate `player_season_stats` into `player_team_decade_stats`.

Run manually (from backend/):
    python -m pipeline.aggregate_decade_stats

What this does:
    Groups every row in `player_season_stats` by (player_id, team_id, decade)
    and computes:
      - games_played        : sum of games across those seasons
      - pts/reb/ast/stl/blk/tov per game : sum of totals / sum of games
      - fg_pct/fg3_pct/ft_pct            : sum of makes / sum of attempts
      - awards              : each season's awards joined by " | "

Safe to re-run — clears and rebuilds the entire table each time so there
is never stale/partial data. Since this reads only from player_season_stats
(no network calls), a full rebuild takes seconds.
"""

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.models import PlayerTeamDecadeStats

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Aggregation query
# ---------------------------------------------------------------------------

# Raw SQL is cleaner here than SQLAlchemy ORM for a GROUP BY aggregation
# of this shape. The logic is straightforward and easier to read/debug as SQL.
AGGREGATE_SQL = text("""
    SELECT
        player_id,
        team_id,
        decade,

        -- counting stats
        SUM(games_played)   AS games_played,
        SUM(pts)            AS total_pts,
        SUM(trb)            AS total_trb,
        SUM(ast)            AS total_ast,
        -- Only sum steals/blocks from seasons where they were recorded
        SUM(CASE WHEN season_start_year >= 1973 THEN stl ELSE 0 END) AS total_stl,
        SUM(CASE WHEN season_start_year >= 1973 THEN blk ELSE 0 END) AS total_blk,
        -- Only count games from those seasons for per-game calculation
        SUM(CASE WHEN season_start_year >= 1973 THEN games_played ELSE 0 END) AS stl_blk_games,
        SUM(CASE WHEN season_start_year >= 1977 THEN tov ELSE 0 END) AS total_tov,
        SUM(CASE WHEN season_start_year >= 1977 THEN games_played ELSE 0 END) AS tov_games,

        -- shooting totals (for percentage calculation)
        SUM(fg)             AS total_fg,
        SUM(fga)            AS total_fga,
        SUM(fg3)            AS total_fg3,
        SUM(fg3a)           AS total_fg3a,
        SUM(ft)             AS total_ft,
        SUM(fta)            AS total_fta,
        SUM(dws)            AS total_dws,
        COUNT(*)            AS season_count,

        -- awards: concatenate non-empty award strings across seasons,
        -- separated by " | " so each season's awards stay identifiable
        GROUP_CONCAT(
            CASE WHEN awards != '' THEN awards END,
            ' | '
        ) AS awards

    FROM player_season_stats
    GROUP BY player_id, team_id, decade
""")


def _safe_pct(makes: int, attempts: int) -> float:
    """Shooting percentage — returns 0.0 if attempts is zero to avoid division by zero."""
    if attempts == 0:
        return 0.0
    return round(makes / attempts, 3)


def _safe_per_game(total: int, games: int) -> float:
    """Per-game average — returns 0.0 if games is zero."""
    if games == 0:
        return 0.0
    return round(total / games, 2)


# ---------------------------------------------------------------------------
# Main aggregation
# ---------------------------------------------------------------------------

def build_decade_stats(db: Session) -> None:
    logger.info("Clearing existing player_team_decade_stats...")
    db.query(PlayerTeamDecadeStats).delete()
    db.commit()

    logger.info("Running aggregation query...")
    rows = db.execute(AGGREGATE_SQL).fetchall()
    logger.info("Aggregating %d (player, team, decade) groups...", len(rows))

    decade_stats = []
    for row in rows:
        games = row.games_played or 0

        decade_stats.append(PlayerTeamDecadeStats(
            player_id=row.player_id,
            team_id=row.team_id,
            decade=row.decade,
            games_played=games,

            pts_per_game=_safe_per_game(row.total_pts, games),
            reb_per_game=_safe_per_game(row.total_trb, games),
            ast_per_game=_safe_per_game(row.total_ast, games),
            stl_per_game=_safe_per_game(row.total_stl, row.stl_blk_games),
            blk_per_game=_safe_per_game(row.total_blk, row.stl_blk_games),
            tov_per_game=_safe_per_game(row.total_tov, row.tov_games),

            fg_pct=_safe_pct(row.total_fg, row.total_fga),
            fg3_pct=_safe_pct(row.total_fg3, row.total_fg3a),
            ft_pct=_safe_pct(row.total_ft, row.total_fta),
            total_fg3a=row.total_fg3a,
            dws_per_season=_safe_per_game(row.total_dws, row.season_count),

            awards=row.awards or "",
        ))

    db.add_all(decade_stats)
    db.commit()
    logger.info("Done. Inserted %d rows into player_team_decade_stats.", len(decade_stats))


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        build_decade_stats(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()