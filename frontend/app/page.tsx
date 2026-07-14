"use client";

import { useState, useCallback, useRef } from "react";
import { DndContext } from "@dnd-kit/core";

import { Player, SpinResponse, spin as spinApi, getPlayers} from "@/lib/api";
import LineupGrid from "@/app/components/LineupGrid";
import PlayerList from "@/app/components/PlayerList";
import SpinReveal from "./components/SpinReveal";

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
  const [respinsTeamLeft, setRespinsTeamLeft] = useState(2);
  const [respinsDecadeLeft, setRespinsDecadeLeft] = useState(2);
  const [hasRespunTeam, setHasRespunTeam] = useState(false);
  const [hasRespunDecade, setHasRespunDecade] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const pendingSpinResult = useRef<SpinResponse | null>(null);
  const pendingTeamName = useRef<string>("");
  const pendingDecadeDisplay = useRef<string>("");
  const spinningWhat = useRef<"all" | "team" | "decade">("all");
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(null);
  const [currentDecade, setCurrentDecade] = useState<number | null>(null);
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
    setIsSpinning(true);
    setError(null);
    setSelectedPlayer(null);
    setCurrentSpin(null);
    setHasRespunTeam(false);
    setHasRespunDecade(false);
    try {
      const result = await spinApi();
      setCurrentTeamId(result.team_id);
      setCurrentDecade(result.decade);
      pendingSpinResult.current = result;
      pendingSpinResult.current = result;
      pendingTeamName.current = result.team_name;
      pendingDecadeDisplay.current = result.decade_display;
      spinningWhat.current = "all";
    } catch (e) {
      setError("Failed to spin. Is the API running?");
      setIsSpinning(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSpinComplete = useCallback(() => {
    if (pendingSpinResult.current) {
      setCurrentSpin(pendingSpinResult.current);
      pendingSpinResult.current = null;
    }
    setIsSpinning(false);
  }, []);

  const handleRespinTeam = useCallback(async () => {
    if (respinsTeamLeft <= 0 || hasRespunTeam || !currentDecade) return;
    setHasRespunTeam(true);
    setRespinsTeamLeft((prev) => prev - 1);
    setIsLoading(true);
    setSelectedPlayer(null);
    spinningWhat.current = "team";
    try {
      let result = await spinApi();
      let players = await getPlayers(result.team_id, currentDecade);
      while (result.team_id === currentTeamId || players.length === 0) {
        result = await spinApi();
        players = await getPlayers(result.team_id, currentDecade);
      }
      setCurrentTeamId(result.team_id);
      setIsSpinning(true);
      setCurrentSpin(null);
      // ... existing API calls and while loop ...
      pendingSpinResult.current = {
        ...result,
        decade: currentDecade,
        decade_display: `${currentDecade}s`,
        players,
      };
      pendingTeamName.current = result.team_name;
      pendingDecadeDisplay.current = `${currentDecade}s`;
      spinningWhat.current = "team";
    } catch (e) {
      setError("Failed to respin team.");
    } finally {
      setIsLoading(false);
    }
  }, [respinsTeamLeft, hasRespunTeam, currentDecade, currentTeamId]);

  const handleRespinDecade = useCallback(async () => {
    if (respinsDecadeLeft <= 0 || hasRespunDecade || !currentTeamId) return;
    setHasRespunDecade(true);
    setRespinsDecadeLeft((prev) => prev - 1);
    setIsLoading(true);
    setSelectedPlayer(null);
    spinningWhat.current = "decade";
    try {
      let result = await spinApi();
      let players = await getPlayers(currentTeamId, result.decade);
      while (result.decade === currentDecade || players.length === 0) {
        result = await spinApi();
        players = await getPlayers(currentTeamId, result.decade);
      }
      setCurrentDecade(result.decade);
      setIsSpinning(true);
      setCurrentSpin(null);
      // ... existing API calls and while loop ...
      pendingSpinResult.current = {
        ...result,
        team_id: currentTeamId,
        team_name: currentSpin!.team_name,
        players,
      };
      pendingTeamName.current = currentSpin!.team_name;
      pendingDecadeDisplay.current = `${result.decade}s`;
      spinningWhat.current = "decade";
    } catch (e) {
      setError("Failed to respin decade.");
    } finally {
      setIsLoading(false);
    }
  }, [respinsDecadeLeft, hasRespunDecade, currentTeamId, currentDecade, currentSpin]);

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
      setCurrentSpin(null);
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
          <span className="text-xl font-black tracking-tighter">Full 82-0</span>
        </header>

        <main className="max-w-full mx-auto px-6 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Players area */}
            <div className="space-y-4">
              <div className="flex items-center gap-3">
              <button
                  onClick={handleSpin}
                  disabled={isLoading || isSpinning || isComplete || currentSpin !== null}
                  className="bg-[#21B8D6] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#178399] transition-colors disabled:opacity-40"
                >
                  {isLoading ? "Spinning..." : "Spin"}
                </button>
              {currentSpin && (
                <>
                  <button
                    onClick={handleRespinDecade}
                    disabled={isLoading || isSpinning || respinsDecadeLeft <= 0 || hasRespunDecade}
                    className="bg-[#D1336F] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#9D2351] transition-colors disabled:opacity-40"
                  >
                    Respin Era ({respinsDecadeLeft})
                  </button>
                  <button
                    onClick={handleRespinTeam}
                    disabled={isLoading || isSpinning || respinsTeamLeft <= 0 || hasRespunTeam}
                    className="bg-[#E68A42] text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-[#B95E19] transition-colors disabled:opacity-40"
                  >
                    Respin Team ({respinsTeamLeft})
                  </button>
                </>
              )}
              </div>

              {/* Player list */}
              {currentSpin && (
                <div data-player-area>
                  <PlayerList
                    key={`${currentSpin.team_id}-${currentSpin.decade}`}
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

              {isSpinning && pendingSpinResult.current && (
                <SpinReveal
                  finalTeam={pendingSpinResult.current.team_name}
                  finalDecade={pendingSpinResult.current.decade_display}
                  onComplete={handleSpinComplete}
                  spinTeam={spinningWhat.current === "all" || spinningWhat.current === "team"}
                  spinDecade={spinningWhat.current === "all" || spinningWhat.current === "decade"}
                />
              )}

              {!currentSpin && !isSpinning && (
                <div className="text-center py-16">
                  <p className="text-sm text-[#AAAAAA]">
                    Press Spin to get your team and decade
                  </p>
                </div>
              )}
            </div>

            <div data-player-area>
              <LineupGrid
                lineup={lineup}
                selectedPlayer={selectedPlayer}
                selectedSlotKey={selectedSlotKey}
                onSlotClick={handleSlotClick}
              />
              {/* Progress */}
              <div className="flex items-center gap-2 p-2">
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
            </div>

            

          </div>
        </main>
      </div>
    </DndContext>
  );
}