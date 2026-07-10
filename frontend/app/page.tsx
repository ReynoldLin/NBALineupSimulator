"use client";

import { useState, useCallback } from "react";
import { DndContext } from "@dnd-kit/core";

import { Player, SpinResponse, spin as spinApi } from "@/lib/api";
import LineupGrid from "@/app/components/LineupGrid";
import PlayerList from "@/app/components/PlayerList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlotKey = string; // e.g. "starter-PG"

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];

const EMPTY_LINEUP: Record<SlotKey, Player | null> = Object.fromEntries(
  ["starter", "bench"].flatMap((row) =>
    POSITIONS.map((pos) => [`${row}-${pos}`, null])
  )
);

const MAX_RESPINS = 2;

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const [lineup, setLineup] = useState<Record<SlotKey, Player | null>>(
    EMPTY_LINEUP
  );
  const [currentSpin, setCurrentSpin] = useState<SpinResponse | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [selectedSlotKey, setSelectedSlotKey] = useState<SlotKey | null>(null);
  const [respinsLeft, setRespinsLeft] = useState(MAX_RESPINS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set of player IDs that are already placed in a slot
  const placedPlayerIds = new Set(
    Object.values(lineup)
      .filter(Boolean)
      .map((p) => p!.player_id)
  );

  // Count filled slots
  const filledSlots = Object.values(lineup).filter(Boolean).length;
  const isComplete = filledSlots === 10;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSpin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSelectedPlayer(null);
    try {
      const result = await spinApi();
      setCurrentSpin(result);
    } catch (e) {
      setError("Failed to spin. Is the API running?");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRespin = useCallback(async () => {
    if (respinsLeft <= 0) return;
    setRespinsLeft((prev) => prev - 1);
    await handleSpin();
  }, [respinsLeft, handleSpin]);

  const handlePlayerClick = useCallback(
    (player: Player) => {
      // Deselect if clicking the same player
      setSelectedPlayer((prev) =>
        prev?.player_id === player.player_id ? null : player
      );
    },
    []
  );

  const handleSlotClick = useCallback(
  (slotKey: SlotKey) => {
    const slotPosition = slotKey.split("-")[1];
    const slotPlayer = lineup[slotKey];

    // Case 1: placing a player from the list
    if (selectedPlayer) {
      if (slotPlayer !== null) return;
      const playerPositions = selectedPlayer.positions.split("/").map((p) => p.trim());
      if (!playerPositions.includes(slotPosition)) return;
      setLineup((prev) => ({ ...prev, [slotKey]: selectedPlayer }));
      setSelectedPlayer(null);
      return;
    }

    // Case 2: no slot selected yet, click a filled slot to select it
    if (!selectedSlotKey) {
      if (slotPlayer === null) return;
      setSelectedSlotKey(slotKey);
      return;
    }

    // Case 3: slot already selected, click another slot
    if (selectedSlotKey === slotKey) {
      // clicked same slot — deselect
      setSelectedSlotKey(null);
      return;
    }

    const selectedSlotPosition = selectedSlotKey.split("-")[1];
    const selectedSlotPlayer = lineup[selectedSlotKey];

    if (!selectedSlotPlayer) {
      setSelectedSlotKey(null);
      return;
    }

    // Case 3a: target slot is empty — move player there
    if (slotPlayer === null) {
      const selectedPlayerPositions = selectedSlotPlayer.positions.split("/").map((p) => p.trim());
      if (!selectedPlayerPositions.includes(slotPosition)) {
        setSelectedSlotKey(null);
        return;
      }
      setLineup((prev) => ({
        ...prev,
        [slotKey]: selectedSlotPlayer,
        [selectedSlotKey]: null,
      }));
      setSelectedSlotKey(null);
      return;
    }

    // Case 3b: target slot is filled — swap if both players are compatible
    const selectedPlayerPositions = selectedSlotPlayer.positions.split("/").map((p) => p.trim());
    const targetPlayerPositions = slotPlayer.positions.split("/").map((p) => p.trim());

    const canSwap =
      selectedPlayerPositions.includes(slotPosition) &&
      targetPlayerPositions.includes(selectedSlotPosition);

    if (!canSwap) {
      setSelectedSlotKey(null);
      return;
    }

    setLineup((prev) => ({
      ...prev,
      [slotKey]: selectedSlotPlayer,
      [selectedSlotKey]: slotPlayer,
    }));
    setSelectedSlotKey(null);
  },
  [selectedPlayer, selectedSlotKey, lineup]
);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DndContext>
      <div
        className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans"
        onClick={(e) => {
          // Deselect player when clicking outside player list / grid
          if ((e.target as HTMLElement).closest("[data-player-area]") === null) {
            setSelectedPlayer(null);
          }
        }}
      >
        {/* Header */}
        <header className="border-b border-[#E5E5E5] px-4 py-3 flex items-center justify-between sticky top-0 bg-[#FAFAFA] z-10">
          <span className="text-xl font-black tracking-tighter">82-0</span>
          <div className="flex items-center gap-3">
            {currentSpin && respinsLeft > 0 && (
              <button
                onClick={handleRespin}
                disabled={isLoading}
                className="text-xs text-[#888] font-mono hover:text-[#111] transition-colors disabled:opacity-40"
              >
                RESPIN ({respinsLeft})
              </button>
            )}
            <button
              onClick={handleSpin}
              disabled={isLoading || isComplete}
              className="bg-[#111111] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#333] transition-colors disabled:opacity-40"
            >
              {isLoading ? "Spinning..." : isComplete ? "Complete!" : "Spin"}
            </button>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

          {/* Lineup grid */}
          <div data-player-area>
            <LineupGrid
              lineup={lineup}
              selectedPlayer={selectedPlayer}
              selectedSlotKey={selectedSlotKey}
              onSlotClick={handleSlotClick}
            />
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-[#E5E5E5]" />
            <span className="text-[10px] font-mono text-[#AAAAAA]">
              {filledSlots}/10
            </span>
            <div className="flex-1 h-px bg-[#E5E5E5]" />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-500 font-mono text-center">
              {error}
            </div>
          )}

          {/* Player list */}
          {currentSpin && (
            <div data-player-area>
              <PlayerList
                teamId={currentSpin.team_id}
                teamName={currentSpin.team_name}
                decadeDisplay={currentSpin.decade_display}
                players={currentSpin.players}
                selectedPlayer={selectedPlayer}
                placedPlayerIds={placedPlayerIds}
                onPlayerClick={handlePlayerClick}
              />
            </div>
          )}

          {/* Empty state — before first spin */}
          {!currentSpin && !isLoading && (
            <div className="text-center py-16">
              <p className="text-sm text-[#AAAAAA] mb-4">
                Press Spin to get your first team and decade
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-16">
              <p className="text-sm font-mono text-[#AAAAAA]">Spinning...</p>
            </div>
          )}

        </main>
      </div>
    </DndContext>
  );
}