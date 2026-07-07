"use client";

import { Player } from "@/lib/api";
import PlayerRow from "@/app/components/PlayerRow";

type PlayerListProps = {
  teamName: string;
  decadeDisplay: string;
  players: Player[];
  selectedPlayer: Player | null;
  placedPlayerIds: Set<number>;
  onPlayerClick: (player: Player) => void;
};

export default function PlayerList({
  teamName,
  decadeDisplay,
  players,
  selectedPlayer,
  placedPlayerIds,
  onPlayerClick,
}: PlayerListProps) {
  return (
    <section>
      {/* Spin result header */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-lg font-bold">{decadeDisplay}</span>
        <span className="text-lg font-bold">{teamName}</span>
        <span className="text-xs text-[#AAAAAA] ml-auto font-mono">
          {players.length} PLAYERS
        </span>
      </div>

      {/* Player rows */}
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
    </section>
  );
}