"use client";

import { Player } from "@/lib/api";
import PlayerRow from "@/app/components/PlayerRow";
import { teamBg, teamHeaderBg } from "@/lib/teams";

type PlayerListProps = {
  teamId: number,
  teamName: string;
  decadeDisplay: string;
  players: Player[];
  selectedPlayer: Player | null;
  placedPlayerIds: Set<number>;
  onPlayerClick: (player: Player) => void;
};

export default function PlayerList({
  teamId,
  teamName,
  decadeDisplay,
  players,
  selectedPlayer,
  placedPlayerIds,
  onPlayerClick,
}: PlayerListProps) {
  return (
    <section>
        <div className="rounded-xl overflow-hidden border border-[#E5E5E5]">
        {/* Spin result header */}
        <div className="flex items-baseline gap-2 p-3" style={{ backgroundColor: teamHeaderBg(teamId) }}>
            <span className="text-lg text-[#EEEEEE] font-bold">{decadeDisplay}</span>
            <span className="text-lg text-[#EEEEEE] font-bold">{teamName}</span>
            <span className="text-xs text-[#EEEEEE] ml-auto font-mono">
            {players.length} PLAYERS
            </span>
        </div>

        {/* Player rows */}
        <div className="rounded-b-lg p-1" style={{ backgroundColor: teamBg(teamId) }}>
            <div className="space-y-0.5">
                {players.map((player) => (
                <PlayerRow
                    key={player.player_id}
                    player={player}
                    isSelected={selectedPlayer?.player_id === player.player_id}
                    isPlaced={placedPlayerIds.has(player.player_id)}
                    onClick={() => onPlayerClick(player)}
                />
                ))}
            </div>
        </div>
      </div>
    </section>
  );
}