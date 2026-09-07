import { getLeaderboard } from '@/lib/db';
import { DEMO } from '@/lib/env';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { Pixel } from '@/components/pixel/Pixel';
import { coin } from '@/components/pixel/sprites';

export const revalidate = 300;
export const metadata = { title: 'Hi-Scores' };

export default async function Leaderboard() {
  const rows = await getLeaderboard(200);
  return (
    <div className="py-16">
      <div className="reveal in flex items-center gap-4">
        <Pixel sprite={coin} size={4} className="anim-spin" />
        <h1 className="text-[18px] md:text-[24px]"><span className="px-hl">HI-SCORES</span></h1>
        <Pixel sprite={coin} size={4} className="anim-spin" />
      </div>
      <p className="mt-6 max-w-2xl text-muted">
        Ranked by grade percentile, then total tokens. Opt-in only: every row was uploaded with{' '}
        <code className="text-fg">tokseal submit</code> and contains aggregate totals only.
        {DEMO && <span className="ml-2 font-pixel text-[9px] text-coral">[DEMO DATA]</span>}
      </p>
      <div className="reveal in mt-10">
        <LeaderboardTable rows={rows} />
      </div>
    </div>
  );
}
