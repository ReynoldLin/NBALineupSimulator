"use client";

import { Player } from "@/lib/api";
import SlotCard from "@/app/components/SlotCard";

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

type SlotKey = string; // e.g. "starter-PG", "bench-SG"

type LineupGridProps = {
  lineup: Record<SlotKey, Player | null>;
  selectedPlayer: Player | null;
  selectedSlotKey: string | null;
  onSlotClick: (slotKey: SlotKey) => void;
};

export default function LineupGrid({
  lineup,
  selectedPlayer,
  selectedSlotKey,
  onSlotClick,
}: LineupGridProps) {
  // Determine which slots are eligible for the selected player
  const eligibleSlots = getEligibleSlots(selectedPlayer, selectedSlotKey, lineup);

  return (
    <section>
      <div className="overflow-x-auto">
        <div className="w-max">
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
                  isSelectedSlot={selectedSlotKey === key}
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
                  isSelectedSlot={selectedSlotKey === key}
                  onClick={() => onSlotClick(key)}
                />
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEligibleSlots(
  selectedPlayer: Player | null,
  selectedSlotKey: string | null,
  lineup: Record<SlotKey, Player | null>
): Set<SlotKey> {
  
  // Case 1: player selected from list — highlight empty slots they can fill
  if (selectedPlayer) {
    const playerPositions = selectedPlayer.positions
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);

    const eligible = new Set<SlotKey>();
    for (const pos of playerPositions) {
      for (const row of ["starter", "bench"]) {
        const key = `${row}-${pos}`;
        if (lineup[key] === null) {
          eligible.add(key);
        }
      }
    }
    return eligible;
  }

  // Case 2: filled slot selected — highlight slots they can swap with
  if (selectedSlotKey) {
    const selectedPlayer = lineup[selectedSlotKey];
    if (!selectedPlayer) return new Set();

    const selectedSlotPosition = selectedSlotKey.split("-")[1];
    const selectedPlayerPositions = selectedPlayer.positions
      .split("/")
      .map((p) => p.trim());

    const eligible = new Set<SlotKey>();

    for (const pos of selectedPlayerPositions) {
      for (const row of ["starter", "bench"]) {
        const key = `${row}-${pos}`;
        if (key === selectedSlotKey) continue;

        // Empty slot — can move there
        if (lineup[key] === null) {
          eligible.add(key);
          continue;
        }

        // Filled slot — only eligible if that player can also play selectedSlotPosition
        const targetPlayer = lineup[key];
        const targetPositions = targetPlayer!.positions
          .split("/")
          .map((p) => p.trim());
        if (targetPositions.includes(selectedSlotPosition)) {
          eligible.add(key);
        }
      }
    }
    return eligible;
  }

  return new Set();
}