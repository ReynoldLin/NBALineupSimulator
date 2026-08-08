"use client";

import { Player } from "@/lib/api";
import { POSITION_COLORS } from "@/lib/positions";

type PlayerRowProps = {
  player: Player;
  isSelected: boolean;
  isPlaced: boolean;   // already placed in a slot
  onClick: () => void;
};

export default function PlayerRow({
  player,
  isSelected,
  isPlaced,
  onClick,
}: PlayerRowProps) {
  return (
    <div
      onClick={isPlaced ? undefined : onClick}
      className={`
        flex flex-col gap-2 px-3 py-2.5 rounded-md border
        2xl:flex-row 2xl:items-center
        transition-all duration-150 select-none
        ${isPlaced
          ? "opacity-40 cursor-not-allowed border-transparent"
          : isSelected
          ? "border-[#111111] bg-white cursor-pointer shadow-sm"
          : "border-transparent hover:border-[#E5E5E5] hover:bg-white cursor-pointer"
        }
      `}
    >
      {/* Left/Row 1: position + name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <span className="text-sm font-semibold truncate block">
            {player.full_name}
          </span>
        </div>
        <div className="flex items-center shrink-0 w-16">
            {player.positions.split("/").map((pos, i, arr) => (
            <span key={pos}>
                <span
                    className="text-[10px] font-black"
                    style={{ color: POSITION_COLORS[pos.trim()] ?? "#AAAAAA" }}
                >
                    {pos.trim()}
                </span>
                {i < arr.length - 1 && (
                    <span className="text-[10px] text-[#CCCCCC]">/</span>
                )}
            </span>
            ))}
        </div>
      </div>
      
      {/* Right group */}
      <div className="flex flex-col gap-2 2xl:flex-row 2xl:items-center 2xl:gap-3 2xl:ml-auto">
        {/* Right/Row 2: stats */}
        <div className="flex items-center gap-3 flex-wrap">
          <Stat label="GP"  value={player.games_played} decimals={0}/>
          <Stat label="PTS" value={player.pts_per_game} />
          <Stat label="REB" value={player.reb_per_game} />
          <Stat label="AST" value={player.ast_per_game} />
          <Stat label="STL" value={player.stl_per_game} />
          <Stat label="BLK" value={player.blk_per_game} />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Ratings */}
          <Stat label="SCO" value={player.scoring_rating ?? 0} />
          <Stat label="SHO" value={player.shooting_rating ?? 0} />
          <Stat label="PMK" value={player.playmaking_rating ?? 0} />
          <Stat label="DEF" value={player.defense_rating ?? 0} />
          <Stat label="REB" value={player.rebounding_rating ?? 0} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
  decimals = 1,
}: {
  label: string;
  value: number;
  className?: string;
  decimals?: number;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span className="text-[9px] font-bold tracking-wider">
        {label}
      </span>
      <span className="text-xs font-mono font-semibold">{value.toFixed(decimals)}</span>
    </div>
  );
}