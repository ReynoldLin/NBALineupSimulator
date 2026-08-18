"use client";

import { useState } from "react";
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
  const [search, setSearch] = useState("");

  const filteredPlayers = players.filter((player) =>
    player.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section>
        <div className="rounded-xl overflow-hidden border border-[#E5E5E5]">
        {/* Spin result header */}
        <div 
          className="flex flex-col gap-2 p-3 2xl:flex-row 2xl:items-baseline" 
          style={{ backgroundColor: teamHeaderBg(teamId) }}
        >
          <span className="text-lg text-[#EEEEEE] font-bold">{decadeDisplay} {teamName}</span>
          <span className="text-xs text-[#EEEEEE] 2xl:ml-4 font-mono">
          {players.length} PLAYERS
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players..."
            className= "w-full 2xl:ml-auto 2xl:w-48 px-3 py-2 text-sm border border-[#E5E5E5] rounded-md bg-white focus:outline-none focus:border-[#111111] transition-colors"
          />
        </div>

        {/* Player rows */}
        <div 
          className="overflow-auto max-h-[60vh] rounded-b-lg p-1" 
          style={{ backgroundColor: teamBg(teamId) }}
        >
          <div className="space-y-0.5">
              {filteredPlayers.map((player) => (
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