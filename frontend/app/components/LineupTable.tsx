"use client";

import { Player } from "@/lib/api";
import { TEAM_NAMES } from "@/lib/teams";

type SlotKey = string;

type LineupTableProps = {
  lineup: Record<SlotKey, Player | null>;
};

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const STAT_COLS = [
  { key: "pts_per_game",   label: "PTS" },
  { key: "reb_per_game",   label: "REB" },
  { key: "ast_per_game",   label: "AST" },
  { key: "stl_per_game",   label: "STL" },
  { key: "blk_per_game",   label: "BLK" },
];

const RATING_COLS = [
  { key: "scoring_rating",    label: "SCO" },
  { key: "shooting_rating",   label: "SHO" },
  { key: "playmaking_rating", label: "PMK" },
  { key: "defense_rating",    label: "DEF" },
  { key: "rebounding_rating", label: "REB" },
];

export default function LineupTable({ lineup }: LineupTableProps) {
  const starters = POSITIONS.map((pos) => ({
    pos,
    player: lineup[`starter-${pos}`],
  }));

  const bench = POSITIONS.map((pos) => ({
    pos,
    player: lineup[`bench-${pos}`],
  }));

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-[#E5E5E5]">
            <th className="text-left py-2 px-3 font-bold text-[#888] tracking-widest text-[10px] w-10">POS</th>
            <th className="text-left py-2 px-3 font-bold text-[#888] tracking-widest text-[10px]">PLAYER</th>
            <th className="text-left py-2 px-3 font-bold text-[#888] tracking-widest text-[10px]">ERA</th>
            <th className="text-left py-2 px-3 font-bold text-[#888] tracking-widest text-[10px]">TEAM</th>
            {STAT_COLS.map((col) => (
              <th key={col.key} className="text-center py-2 px-3 font-bold text-[#888] tracking-widest text-[10px]">
                {col.label}
              </th>
            ))}
            <th className="w-px bg-[#E5E5E5]" />
            {RATING_COLS.map((col) => (
              <th key={col.key} className="text-center py-2 px-3 font-bold text-[#888] tracking-widest text-[10px]">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Starters */}
          <tr>
            <td colSpan={4 + STAT_COLS.length + 1 + RATING_COLS.length}
              className="py-1 px-3 text-[10px] font-bold tracking-widest text-[#888] uppercase bg-[#F5F5F5]">
              Starters
            </td>
          </tr>
          {starters.map(({ pos, player }) => (
            <PlayerRow key={`starter-${pos}`} pos={pos} player={player} />
          ))}

          {/* Bench */}
          <tr>
            <td colSpan={4 + STAT_COLS.length + 1 + RATING_COLS.length}
              className="py-1 px-3 text-[10px] font-bold tracking-widest text-[#888] uppercase bg-[#F5F5F5]">
              Bench
            </td>
          </tr>
          {bench.map(({ pos, player }) => (
            <PlayerRow key={`bench-${pos}`} pos={pos} player={player} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRow({ pos, player }: { pos: string; player: Player | null }) {
  if (!player) return null;

  return (
    <tr className="border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors">
      <td className="py-2 px-3 font-bold text-[10px]" style={{ color: "#888" }}>
        {pos}
      </td>
      <td className="py-2 px-3 font-semibold text-[#111]">
        {player.full_name}
      </td>
      <td className="py-2 px-3 font-mono text-[#888]">
        {player.decade}s
      </td>
      <td className="py-2 px-3 text-[#888]">
        {TEAM_NAMES[player.team_id] ?? player.team_id}
      </td>
      {STAT_COLS.map((col) => (
        <td key={col.key} className="py-2 px-3 text-center font-mono font-bold text-[#111]">
          {((player as any)[col.key] ?? 0).toFixed(1)}
        </td>
      ))}
      <td className="w-px bg-[#E5E5E5]" />
      {RATING_COLS.map((col) => (
        <td key={col.key} className="py-2 px-3 text-center font-mono font-bold text-[#111]">
          {((player as any)[col.key] ?? 0).toFixed(1)}
        </td>
      ))}
    </tr>
  );
}