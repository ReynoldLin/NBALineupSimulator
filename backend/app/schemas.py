"""
Pydantic schemas — defines the shape of data going in and out of the API.

These are separate from SQLAlchemy models (models.py) which define the DB
tables. Schemas define what the frontend sees; models define what SQLite stores.
"""

from pydantic import BaseModel
from typing import Optional


# ---------------------------------------------------------------------------
# Player schemas
# ---------------------------------------------------------------------------

class PlayerSummary(BaseModel):
    """A player as returned in the spin/players endpoints — enough info
    to display on the selection screen."""

    player_id: int
    full_name: str
    positions: str
    games_played: int
    pts_per_game: float
    reb_per_game: float
    ast_per_game: float
    stl_per_game: float
    blk_per_game: float
    tov_per_game: float
    fg_pct: float
    fg3_pct: float
    ft_pct: float
    awards: str
    headshot_url: Optional[str] = None

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Game schemas
# ---------------------------------------------------------------------------

class SpinResponse(BaseModel):
    """Response for GET /game/spin — a random (team, decade) combo with
    all available players for that combo."""

    team_id: int
    team_name: str
    decade: int
    decade_display: str         # e.g. "2000s"
    players: list[PlayerSummary]


class LineupPlayer(BaseModel):
    """One player pick in a submitted lineup."""

    player_id: int
    team_id: int
    decade: int
    position: str               # e.g. "PG"
    is_starter: bool


class GradeRequest(BaseModel):
    """Request body for POST /game/grade — the completed 10-man lineup."""

    picks: list[LineupPlayer]


class GradeResponse(BaseModel):
    """Response for POST /game/grade."""

    score: float                # 0-82, placeholder until grading logic is built
    message: str                # e.g. "74-8 — Elite lineup!"