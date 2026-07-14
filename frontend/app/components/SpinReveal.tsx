"use client";

import { useEffect, useState, useRef } from "react";

const TEAMS = [
    "Atlanta Hawks",
    "Boston Celtics",
    "Brooklyn Nets",
    "Charlotte Hornets",
    "Chicago Bulls",
    "Cleveland Cavaliers",
    "Dallas Mavericks",
    "Denver Nuggets",
    "Detroit Pistons",
    "Golden State Warriors",
    "Houston Rockets",
    "Indiana Pacers",
    "LA Clippers",
    "Los Angeles Lakers",
    "Memphis Grizzlies",
    "Miami Heat",
    "Milwaukee Bucks",
    "Minnesota Timberwolves",
    "New Orleans Pelicans",
    "New York Knicks",
    "Oklahoma City Thunder",
    "Orlando Magic",
    "Philadelphia 76ers",
    "Phoenix Suns",
    "Portland Trail Blazers",
    "Sacramento Kings",
    "San Antonio Spurs",
    "Toronto Raptors",
    "Utah Jazz",
    "Washington Wizards"
];

const DECADES = ["1960s", "1970s", "1980s", "1990s", "2000s", "2010s", "2020s"];

type SpinRevealProps = {
  onComplete: () => void;  // called when animation finishes
  finalTeam: string;
  finalDecade: string;
  spinTeam?: boolean;
  spinDecade?: boolean;
};

export default function SpinReveal({
  onComplete,
  finalTeam,
  finalDecade,
  spinTeam,
  spinDecade,
}: SpinRevealProps) {
  const [displayTeam, setDisplayTeam] = useState(finalTeam);
  const [displayDecade, setDisplayDecade] = useState(finalDecade);
  const [phase, setPhase] = useState<"fast" | "slow" | "done">("fast");
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let phaseTimeout: NodeJS.Timeout;
    let doneTimeout: NodeJS.Timeout;

    // Phase 1: fast cycling every 80ms for 1.5s
    interval = setInterval(() => {
        if (spinTeam) {
            setDisplayTeam(TEAMS[Math.floor(Math.random() * TEAMS.length)]);
        }
        if (spinDecade) {
            setDisplayDecade(DECADES[Math.floor(Math.random() * DECADES.length)]);
        }
    }, 80);

    // Phase 2: slow down after 1.5s
    phaseTimeout = setTimeout(() => {
      clearInterval(interval);
      setPhase("slow");

      interval = setInterval(() => {
        if (spinTeam) {
            setDisplayTeam(TEAMS[Math.floor(Math.random() * TEAMS.length)]);
        }
        if (spinDecade) {
            setDisplayDecade(DECADES[Math.floor(Math.random() * DECADES.length)]);
        }
      }, 180);

      // Phase 3: reveal final result after another 0.8s
      doneTimeout = setTimeout(() => {
        clearInterval(interval);
        setPhase("done");
        setDisplayTeam(finalTeam);
        setDisplayDecade(finalDecade);

        // Give user a moment to see the result before player list appears
        setTimeout(() => onCompleteRef.current(), 600);
      }, 800);
    }, 1500);

    return () => {
      clearInterval(interval);
      clearTimeout(phaseTimeout);
      clearTimeout(doneTimeout);
    };
  }, [finalTeam, finalDecade]);

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-3">
      {/* Decade */}
      <div
        className="text-xl font-bold transition-all duration-200"
        style={{
          opacity: !spinDecade || phase === "done" ? 1 : 0.5,
        }}
      >
        {displayDecade}
      </div>

      {/* Team name */}
      <div
        className="text-2xl font-black tracking-tight transition-all duration-200 text-center"
        style={{
          opacity: !spinTeam || phase === "done" ? 1 : 0.5,
        }}
      >
        {displayTeam}
      </div>
    </div>
  );
}