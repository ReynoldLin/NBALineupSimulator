"""
Game router — endpoints for the core game loop.

Endpoints:
    GET  /game/spin          — random (team, decade) + available players
    GET  /game/players       — players for a specific (team_id, decade)
    POST /game/grade         — grade a completed 10-man lineup (placeholder)
"""

import random
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import Player, PlayerTeamDecadeStats, Team
from app.schemas import GradeRequest, GradeResponse, PlayerSummary, SpinResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/game", tags=["game"])

VALID_DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _decade_display(decade: int) -> str:
    """Convert decade int to display string. e.g. 2000 -> '2000s'"""
    return f"{decade}s"


def _get_players_for_combo(
    team_id: int, decade: int, db: Session
) -> list[PlayerSummary]:
    """Query player_team_decade_stats joined with players for a given
    (team_id, decade) combo. Returns a list of PlayerSummary objects."""

    rows = (
        db.query(PlayerTeamDecadeStats, Player)
        .join(Player, PlayerTeamDecadeStats.player_id == Player.player_id)
        .filter(
            PlayerTeamDecadeStats.team_id == team_id,
            PlayerTeamDecadeStats.decade == decade,
        )
        .order_by(PlayerTeamDecadeStats.pts_per_game.desc())
        .all()
    )

    players = []
    for stats, player in rows:
        players.append(PlayerSummary(
            player_id=player.player_id,
            team_id=stats.team_id,
            decade=stats.decade,
            full_name=player.full_name,
            positions=player.positions,
            games_played=stats.games_played,
            pts_per_game=stats.pts_per_game,
            reb_per_game=stats.reb_per_game,
            ast_per_game=stats.ast_per_game,
            stl_per_game=stats.stl_per_game,
            blk_per_game=stats.blk_per_game,
            tov_per_game=stats.tov_per_game,
            fg_pct=stats.fg_pct,
            fg3_pct=stats.fg3_pct,
            ft_pct=stats.ft_pct,
            awards=stats.awards,
            headshot_url=player.headshot_url
        ))
    return players


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/spin", response_model=SpinResponse)
def spin(db: Session = Depends(get_db)):
    """Return a random (team, decade) combo that has at least one player,
    along with all available players for that combo."""

    # Get all valid (team_id, decade) combos from player_team_decade_stats
    combos = (
        db.query(PlayerTeamDecadeStats.team_id, PlayerTeamDecadeStats.decade)
        .distinct()
        .all()
    )

    if not combos:
        raise HTTPException(status_code=404, detail="No valid team/decade combos found.")

    team_id, decade = random.choice(combos)

    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")

    players = _get_players_for_combo(team_id, decade, db)

    return SpinResponse(
        team_id=team_id,
        team_name=team.full_name,
        decade=decade,
        decade_display=_decade_display(decade),
        players=players,
    )


@router.get("/players", response_model=list[PlayerSummary])
def get_players(team_id: int, decade: int, db: Session = Depends(get_db)):
    """Return all players for a given (team_id, decade) combo.
    Useful if the frontend needs to re-fetch players without a full spin."""

    if decade not in VALID_DECADES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid decade. Must be one of {VALID_DECADES}."
        )

    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail=f"Team {team_id} not found.")

    players = _get_players_for_combo(team_id, decade, db)

    if not players:
        raise HTTPException(
            status_code=404,
            detail=f"No players found for team {team_id} in the {_decade_display(decade)}."
        )

    return players


@router.post("/grade", response_model=GradeResponse)
def grade_lineup(request: GradeRequest, db: Session = Depends(get_db)):
    """Grade a completed 10-man lineup. Returns a score out of 82.
    Placeholder until grading metrics are added to player_team_decade_stats."""

    if len(request.picks) != 10:
        raise HTTPException(
            status_code=400,
            detail=f"Lineup must have exactly 10 players, got {len(request.picks)}."
        )

    # Placeholder grading logic — returns 82 until real metrics are built
    score = 82.0
    message = "82-0 — The greatest team ever assembled!"

    return GradeResponse(score=score, message=message)