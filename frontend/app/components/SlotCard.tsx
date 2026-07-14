"use client";

import { useDroppable } from "@dnd-kit/core";
import { Player } from "@/lib/api";
import { POSITION_COLORS, positionBg, positionFilledBg } from "@/lib/positions";
import { TEAM_COLORS } from "@/lib/teams";

type SlotCardProps = {
  id: string;           // e.g. "starter-PG"
  position: string;     // e.g. "PG"
  player: Player | null;
  isEligible: boolean;  // slot is highlighted as a valid drop target
  isSelectedSlot: boolean,
  onClick: () => void;
};

export default function SlotCard({
  id,
  position,
  player,
  isEligible,
  isSelectedSlot,
  onClick,
}: SlotCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const isEmpty = !player;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        background: isEmpty
          ? positionBg(position)
          : `linear-gradient(to bottom, ${TEAM_COLORS[player.team_id] ?? "#111111"} 0%, ${TEAM_COLORS[player.team_id] ?? "#111111"} 10%, #FFFFFF 0%)`,
        borderColor: isEmpty && isEligible ? POSITION_COLORS[position] : undefined,
      }}
        className={`
        relative rounded-lg border h-60 flex flex-col overflow-hidden
        transition-all duration-150
        ${isEmpty && !isEligible ? "border-[#E5E5E5] cursor-pointer hover:opacity-80" : ""}
        ${isEmpty && isEligible ? "ring-2 ring-offset-1 cursor-pointer" : ""}
        ${!isEmpty ? "border-transparent text-white" : ""}
        ${isEligible ? "ring-2 ring-offset-1 ring-[#111111]" : ""}
        ${isSelectedSlot ? "ring-2 ring-offset-1 ring-[#111111]" : ""}
        `}
    >
      {/* Diagonal stripe texture on empty non-eligible slots */}
      {isEmpty && !isEligible && (
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)",
            backgroundSize: "8px 8px",
          }}
        />
      )}

      {!isEmpty && (
        <>
          <div className="text-center">
            <span className="text-[10px] font-mono font-bold text-white">
              {player.decade}s
            </span>
          </div>
          <div className="flex-auto flex items-center justify-center overflow-hidden p-4">
              <img
                src={player.headshot_url ?? "https://placehold.net/avatar.png"}
                alt={player.full_name}
                className="h-full w-auto object-cover object-top"
              />
          </div>
        </>
      )}

      {isEmpty ? (
        <div className="flex-1 flex items-end p-2">
          <span className="text-[10px] font-black tracking-widest"
            style={{ color: POSITION_COLORS[position] ?? "#AAAAAA" }}>
            {position}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex items-end p-2">
          <span className="text-[10px] font-black tracking-widest w-5 shrink-0"
            style={{ color: POSITION_COLORS[position] ?? "#AAAAAA" }}>
            {position}
          </span>
          <span className="text-xs font-bold leading-tight text-center text-black line-clamp-1 overflow-ellipsis flex-1">
            {player.full_name}
          </span>
          <div className="w-5 shrink-0">
            <img
              src={`/logos/${player.team_id}.svg`}
              alt={`player.team_id`}
              className="h-5 w-5 object-contain"
            />
          </div>
        </div>
      )}

    </div>
  );
}