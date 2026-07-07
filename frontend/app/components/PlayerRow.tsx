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
        flex items-center justify-between px-3 py-2.5 rounded-md border
        transition-all duration-150 select-none
        ${isPlaced
          ? "opacity-40 cursor-not-allowed border-transparent"
          : isSelected
          ? "border-[#111111] bg-white cursor-pointer shadow-sm"
          : "border-transparent hover:border-[#E5E5E5] hover:bg-white cursor-pointer"
        }
      `}
    >
      {/* Left: position + name */}
      <div className="flex items-center gap-3 min-w-0">
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
        <div className="min-w-0">
          <span className="text-sm font-semibold truncate block">
            {player.full_name}
          </span>
        </div>
      </div>

      {/* Right: stats */}
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <Stat label="PTS" value={player.pts_per_game} />
        <Stat label="REB" value={player.reb_per_game} />
        <Stat label="AST" value={player.ast_per_game} />
        <Stat label="STL" value={player.stl_per_game} className="hidden sm:flex" />
        <Stat label="BLK" value={player.blk_per_game} className="hidden sm:flex" />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      <span className="text-[9px] font-bold tracking-wider">
        {label}
      </span>
      <span className="text-xs font-mono font-semibold">{value.toFixed(1)}</span>
    </div>
  );
}