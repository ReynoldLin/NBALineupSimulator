"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { DndContext } from "@dnd-kit/core";

import { Player, SpinResponse, spin as spinApi, getPlayers, gradeLineup} from "@/lib/api";
import LineupGrid from "@/app/components/LineupGrid";
import PlayerList from "@/app/components/PlayerList";
import SpinReveal from "./components/SpinReveal";
import { TEAM_NAMES, TEAM_COLORS } from "@/lib/teams";
import LineupTable from "./components/LineupTable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SlotKey = string; // e.g. "starter-PG"

const POSITIONS = ["PG", "SG", "SF", "PF", "C"];
const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

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
  const [respinsTeamLeft, setRespinsTeamLeft] = useState(MAX_RESPINS);
  const [respinsDecadeLeft, setRespinsDecadeLeft] = useState(MAX_RESPINS);
  const [hasRespunTeam, setHasRespunTeam] = useState(false);
  const [hasRespunDecade, setHasRespunDecade] = useState(false);
  const [isSpinning, setIsSpinning] = useState(false);
  const pendingSpinResult = useRef<SpinResponse | null>(null);
  const pendingTeamName = useRef<string>("");
  const pendingDecadeDisplay = useRef<string>("");
  const spinningWhat = useRef<"all" | "team" | "decade">("all");
  const [currentTeamId, setCurrentTeamId] = useState<number | null>(null);
  const [currentDecade, setCurrentDecade] = useState<number | null>(null);
  const [record, setRecord] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [debugTeamId, setDebugTeamId] = useState<number | null>(null);
  const [debugDecade, setDebugDecade] = useState<number | null>(null);
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

  useEffect(() => {
    if (isComplete) {
      const picks = Object.entries(lineup)
        .filter(([, player]) => player !== null)
        .map(([slotKey, player]) => ({
          player_id: player!.player_id,
          team_id: player!.team_id,
          decade: player!.decade,
          position: slotKey.split("-")[1],
          is_starter: slotKey.startsWith("starter"),
        }));

      gradeLineup(picks)
        .then((result) => {
          console.log("Grade result:", result);
          setRecord(result.message);
        })
        .catch(() => setRecord("??-??"));
    } else {
      setRecord(null);
    }
  }, [isComplete]);

  // Debug Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        setDebugMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
    if (isComplete) return;
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

  const handleReset = useCallback(() => {
    setLineup(EMPTY_LINEUP);
    setCurrentSpin(null);
    setSelectedPlayer(null);
    setSelectedSlotKey(null);
    setRespinsTeamLeft(MAX_RESPINS);
    setRespinsDecadeLeft(MAX_RESPINS);
    setHasRespunTeam(false);
    setHasRespunDecade(false);
    setCurrentTeamId(null);
    setCurrentDecade(null);
    setIsSpinning(false);
    setRecord(null);
    setError(null);
    pendingSpinResult.current = null;
    pendingTeamName.current = "";
    pendingDecadeDisplay.current = "";
  }, []);

  // Debug Mode
  const handleDebugSpin = useCallback(async () => {
    if (!debugTeamId || !debugDecade) return;
    setIsLoading(true);
    setSelectedPlayer(null);
    setCurrentSpin(null);
    try {
      const players = await getPlayers(debugTeamId, debugDecade);
      const teamName = Object.values(TEAM_COLORS).length > 0
        ? debugTeamId.toString()
        : debugTeamId.toString();
      setCurrentSpin({
        team_id: debugTeamId,
        team_name: TEAM_NAMES[debugTeamId] ?? debugTeamId.toString(),
        decade: debugDecade,
        decade_display: `${debugDecade}s`,
        players,
      });
      setCurrentTeamId(debugTeamId);
      setCurrentDecade(debugDecade);
    } catch (e) {
      setError("Debug spin failed.");
    } finally {
      setIsLoading(false);
    }
  }, [debugTeamId, debugDecade]);

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
          <span className="text-xl font-black tracking-tighter">10 Man 82-0</span>
        </header>

        <main className="max-w-full mx-auto px-6 py-6 pb-72 2xl:pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* Players area */}
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 2xl:gap-3 flex-wrap">
              <button
                  onClick={handleSpin}
                  disabled={isLoading || isSpinning || isComplete || currentSpin !== null}
                  className="bg-[#21B8D6] text-white text-sm font-semibold px-2.5 py-1.5 2xl:px-4 2xl:py-2 rounded-md hover:bg-[#178399] transition-colors disabled:opacity-40 whitespace-nowrap"
                >
                  {isLoading ? "Spinning..." : "Spin"}
                </button>
              {currentSpin && (
                <>
                  <button
                    onClick={handleRespinDecade}
                    disabled={isLoading || isSpinning || respinsDecadeLeft <= 0 || hasRespunDecade}
                    className="bg-[#D1336F] text-white text-sm font-semibold px-2.5 py-1.5 2xl:px-4 2xl:py-2 rounded-md hover:bg-[#9D2351] transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    Respin Era ({respinsDecadeLeft})
                  </button>
                  <button
                    onClick={handleRespinTeam}
                    disabled={isLoading || isSpinning || respinsTeamLeft <= 0 || hasRespunTeam}
                    className="bg-[#E68A42] text-white text-sm font-semibold px-2.5 py-1.5 2xl:px-4 2xl:py-2 rounded-md hover:bg-[#B95E19] transition-colors disabled:opacity-40 whitespace-nowrap"
                  >
                    Respin Team ({respinsTeamLeft})
                  </button>
                </>
              )}
              </div>
              
              {/* Debug Mode */}
              {debugMode && (
              <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono font-bold text-yellow-700">DEBUG</span>
                
                <select
                  className="text-xs border border-yellow-300 rounded px-2 py-1 bg-white"
                  value={debugTeamId ?? ""}
                  onChange={(e) => setDebugTeamId(Number(e.target.value))}
                >
                  <option value="">Select team...</option>
                  {Object.entries(TEAM_NAMES).map(([id, name]) => (
                    <option key={id} value={id}>{name}</option>
                  ))}
                </select>

                <select
                  className="text-xs border border-yellow-300 rounded px-2 py-1 bg-white"
                  value={debugDecade ?? ""}
                  onChange={(e) => setDebugDecade(Number(e.target.value))}
                >
                  <option value="">Select decade...</option>
                  {DECADES.map((d) => (
                    <option key={d} value={d}>{d}s</option>
                  ))}
                </select>

                <button
                  onClick={handleDebugSpin}
                  disabled={!debugTeamId || !debugDecade || isLoading}
                  className="text-xs bg-yellow-500 text-white px-3 py-1 rounded font-semibold disabled:opacity-40"
                >
                  Load
                </button>
              </div>
            )}

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

              {record && (
                <div className="space-y-6">
                  <div className="text-center py-6">
                    <span className="text-[10px] font-bold tracking-widest text-[#888] uppercase">
                      Season Record
                    </span>
                    <div className="text-6xl font-black tracking-tighter mt-1">
                      {record}
                    </div>
                    <button
                      onClick={handleReset}
                      className="bg-[#111111] text-white text-sm font-semibold px-6 py-2 mt-6 rounded-md hover:bg-[#333] transition-colors"
                    >
                      Play Again
                    </button>
                  </div>
                  <LineupTable lineup={lineup} />
                </div>
              )}

            </div>

            <div data-player-area
                 className="fixed bottom-0 left-0 right-0 bg-[#FAFAFA] border-t border-[#E5E5E5] z-20 px-4 py-2 flex flex-col items-center 2xl:static 2xl:border-t-0 2xl:px-0 2xl:py-0 2xl:block">
              <LineupGrid
                lineup={lineup}
                selectedPlayer={selectedPlayer}
                selectedSlotKey={selectedSlotKey}
                onSlotClick={handleSlotClick}
              />
              
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