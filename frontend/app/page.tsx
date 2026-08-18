import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#111111] font-sans">
      
      <main className="max-w-2xl mx-auto px-6 py-16 flex flex-col items-center text-center">
        {/* Hero */}
        <img src="/logo.png" alt="10 Man 82-0" className="w-16 h-16 mb-6" />

        <h1 className="text-5xl font-black tracking-tighter mb-3">
          10 Man 82-0
        </h1>
        <p className="text-[#888] text-sm font-medium tracking-wide mb-8 max-w-md">
          Spin for a random team and decade to select players for your 10 man NBA lineup.
        </p>

        <Link href="/game">
          <button className="bg-[#21B8D6] text-white text-base font-semibold px-8 py-2 rounded-md hover:bg-[#178399] transition-colors">
            Play
          </button>
        </Link>

        {/* How to play */}
        <section className="mt-20 w-full text-left">
          <span className="text-[10px] font-bold tracking-widest text-[#888] uppercase">
            Instructions
          </span>

          <div className="mt-4 space-y-3">
            <div className="border border-[#E5E5E5] rounded-md px-4 py-3 flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold">How To Play</p>
                <p className="text-sm text-[#888] mt-0.5">
                  Spin to land on a random team and era (1960s - 2020s). Select one player from that list and place them into an open, eligible position.
                </p>
                <p className="text-sm text-[#888] mt-2">
                  Players can be moved around to different positions and to a starter/bench if they are eligible.
                </p>
                <p className="text-sm text-[#888] mt-2">
                  You get 2 era and team respins per game, but only 1 per round.
                </p>
                <p className="text-sm text-[#888] mt-2">
                  Build your 10 man lineup consisting of starters and bench players.
                </p>
              </div>
            </div>

            <div className="border border-[#E5E5E5] rounded-md px-4 py-3 flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold">Player Ratings</p>
                <p className="text-sm text-[#888] mt-0.5">
                  Each player has been given 5 ratings:
                </p>
                <ul className="list-disc list-inside text-sm text-[#888] mt-2 space-y-1 ml-4">
                    <li className="text-sm text-[#888] mt-2">Scoring (SCO)</li>
                    <li className="text-sm text-[#888] mt-2">Shooting (SHO)</li>
                    <li className="text-sm text-[#888] mt-2">Playmaking (PMK)</li>
                    <li className="text-sm text-[#888] mt-2">Defense (DEF)</li>
                    <li className="text-sm text-[#888] mt-2">Rebounding (REB)</li>
                </ul>
                <p className="text-sm text-[#888] mt-2">
                  These ratings have been determined by their statistical outputs, as well as their accolades for their specific team and era.
                  Ratings are normalised against other players within the same era. There is a penalty for players who haven't played many games for a team in the era.
                </p>
              </div>
            </div>

            <div className="border border-[#E5E5E5] rounded-md px-4 py-3 flex items-start gap-3">
              <div>
                <p className="text-sm font-semibold">Winning Formula</p>
                <p className="text-sm text-[#888] mt-0.5">
                  Prioritise team fit over talent. Your backcourt should complement each other, and your frontcourt should complement each other for the best results.
                  For example, two poor defenders at PG and SG will hinder your record, but a strong defender can cover for a weak defender.
                </p>
                <p className="text-sm text-[#888] mt-2">
                  Starters are more important than the bench, but don't sleep on the bench either.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}