"use client";

import { Player } from "@/lib/api";
import SlotCard from "@/app/components/SlotCard";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

type SlotKey = string; // e.g. "starter-PG", "bench-SG"

type LineupGridProps = {
  lineup: Record<SlotKey, Player | null>;
  selectedPlayer: Player | null;
  onSlotClick: (slotKey: SlotKey) => void;
};

export default function LineupGrid({
  lineup,
  selectedPlayer,
  onSlotClick,
}: LineupGridProps) {
  // Determine which slots are eligible for the selected player
  const eligibleSlots = getEligibleSlots(selectedPlayer, lineup);

  return (
    <section>
      {/* Starters */}
      <div className="mb-2">
        <span className="text-[10px] font-bold tracking-widest text-[#888] uppercase">
          Starters
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2 mb-4">
        {POSITIONS.map((pos) => {
          const key = `starter-${pos}`;
          return (
            <SlotCard
              key={key}
              id={key}
              position={pos}
              player={lineup[key]}
              isEligible={eligibleSlots.has(key)}
              onClick={() => onSlotClick(key)}
            />
          );
        })}
      </div>

      {/* Bench */}
      <div className="mb-2">
        <span className="text-[10px] font-bold tracking-widest text-[#888] uppercase">
          Bench
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {POSITIONS.map((pos) => {
          const key = `bench-${pos}`;
          return (
            <SlotCard
              key={key}
              id={key}
              position={pos}
              player={lineup[key]}
              isEligible={eligibleSlots.has(key)}
              onClick={() => onSlotClick(key)}
            />
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEligibleSlots(
  selectedPlayer: Player | null,
  lineup: Record<SlotKey, Player | null>
): Set<SlotKey> {
  if (!selectedPlayer) return new Set();

  // Parse positions from the player e.g. "PG/SG" -> ["PG", "SG"]
  const playerPositions = selectedPlayer.positions
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);

  const eligible = new Set<SlotKey>();

  for (const pos of playerPositions) {
    for (const row of ["starter", "bench"]) {
      const key = `${row}-${pos}`;
      // Only eligible if the slot is empty
      if (lineup[key] === null) {
        eligible.add(key);
      }
    }
  }

  return eligible;
}