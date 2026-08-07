const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Player = {
  player_id: number;
  team_id: number;
  decade: number;
  full_name: string;
  positions: string;
  games_played: number;
  pts_per_game: number;
  reb_per_game: number;
  ast_per_game: number;
  stl_per_game: number;
  blk_per_game: number;
  tov_per_game: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  scoring_rating: number | null;
  shooting_rating: number | null;
  playmaking_rating: number | null;
  defense_rating: number | null;
  rebounding_rating: number | null;
  awards: string;
  headshot_url: string | null;
};

export type SpinResponse = {
  team_id: number;
  team_name: string;
  decade: number;
  decade_display: string;
  players: Player[];
};

export type LineupPick = {
  player_id: number;
  team_id: number;
  decade: number;
  position: string;
  is_starter: boolean;
};

export type GradeResponse = {
  score: number;
  message: string;
};

export type LineupPickRequest = {
  slot_number: number;
  position: string;
  is_starter: boolean;
  team_id: number;
  decade: number;
  player_id: number;
};

export type SaveLineupRequest = {
  record: string;
  picks: LineupPickRequest[];
};

export type SaveLineupResponse = {
  lineup_id: string;
};

export type LineupPickDetail = {
  slot_number: number;
  position: string;
  is_starter: boolean;
  decade: number;
  player_id: number;
  full_name: string;
  team_id: number;
  team_name: string;
  pts_per_game: number;
  reb_per_game: number;
  ast_per_game: number;
  stl_per_game: number;
  blk_per_game: number;
  scoring_rating: number | null;
  shooting_rating: number | null;
  playmaking_rating: number | null;
  defense_rating: number | null;
  rebounding_rating: number | null;
  headshot_url: string | null;
};

export type LineupDetailResponse = {
  lineup_id: string;
  record: string;
  created_at: string;
  picks: LineupPickDetail[];
};

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function spin(): Promise<SpinResponse> {
  const res = await fetch(`${API_URL}/game/spin`);
  if (!res.ok) throw new Error(`Spin failed: ${res.status}`);
  return res.json();
}

export async function getPlayers(
  teamId: number,
  decade: number
): Promise<Player[]> {
  const res = await fetch(
    `${API_URL}/game/players?team_id=${teamId}&decade=${decade}`
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`Get players failed: ${res.status}`);
  return res.json();
}

export async function gradeLineup(
  picks: LineupPick[]
): Promise<GradeResponse> {
  const res = await fetch(`${API_URL}/game/grade`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ picks }),
  });
  if (!res.ok) throw new Error(`Grade failed: ${res.status}`);
  return res.json();
}

export async function saveLineup(
  request: SaveLineupRequest
): Promise<SaveLineupResponse> {
  const res = await fetch(`${API_URL}/lineups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`Save lineup failed: ${res.status}`);
  return res.json();
}

export async function getLineup(lineupId: string): Promise<LineupDetailResponse> {
  const res = await fetch(`${API_URL}/lineups/${lineupId}`);
  if (!res.ok) throw new Error(`Get lineup failed: ${res.status}`);
  return res.json();
}