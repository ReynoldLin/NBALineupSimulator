"use client";

import { useDroppable } from "@dnd-kit/core";
import { Player } from "@/lib/api";
import { POSITION_COLORS, positionBg, positionFilledBg } from "@/lib/positions";

type SlotCardProps = {
  id: string;           // e.g. "starter-PG"
  position: string;     // e.g. "PG"
  player: Player | null;
  isEligible: boolean;  // slot is highlighted as a valid drop target
  onClick: () => void;
};

export default function SlotCard({
  id,
  position,
  player,
  isEligible,
  onClick,
}: SlotCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const isEmpty = !player;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        backgroundColor: isEmpty ? positionBg(position) : positionFilledBg(position),
        borderColor: isEmpty && isEligible ? POSITION_COLORS[position] : undefined,
        }}
        className={`
        relative rounded-lg border h-24 flex flex-col overflow-hidden
        transition-all duration-150
        ${isEmpty && !isEligible ? "border-[#E5E5E5] cursor-pointer hover:opacity-80" : ""}
        ${isEmpty && isEligible ? "ring-2 ring-offset-1 cursor-pointer" : ""}
        ${!isEmpty ? "border-transparent text-white" : ""}
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

      {/* Position label */}
        <div className="px-2 pt-2">
        <span className="text-[10px] font-black tracking-widest" style={{ color: POSITION_COLORS[position] ?? "#AAAAAA" }}>
            {position}
        </span>
        </div>

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <span className={`text-[10px] font-mono ${isEligible ? "text-[#111111]" : "text-[#CCCCCC]"}`}>
            {isEligible ? "PLACE HERE" : "EMPTY"}
          </span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-end p-2">
          <span className="text-xs text-[#111111] font-bold leading-tight line-clamp-2">
            {player.full_name}
          </span>
        </div>
      )}
    </div>
  );
}