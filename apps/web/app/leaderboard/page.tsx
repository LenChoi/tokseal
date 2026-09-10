import Link from 'next/link';
import { getLeaderboard, getSeason } from '@/lib/db';
import { DEMO } from '@/lib/env';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import { SeasonTable } from '@/components/SeasonTable';
import { Pixel } from '@/components/pixel/Pixel';
import { coin } from '@/components/pixel/sprites';

export const revalidate = 300;
export const metadata = { title: 'Hi-Scores' };

type Props = { searchParams: Promise<{ season?: string }> };

const thisMonth = () => new Date().toISOString().slice(0, 7);
const prevMonth = (m: string) => { const d = new Date(m + '-01T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 7); };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return <Link href={href} className={`px-4 py-3 font-pixel text-[10px] uppercase ${active ? 'bg-coral text-ink' : 'bg-[#120b22] text-muted hover:text-fg'}`}>{children}</Link>;
}

export default async function Leaderboard({ searchParams }: Props) {
  const sp = await searchParams;
  const season = sp.season && /^\d{4}-\d{2}$/.test(sp.season) ? sp.season : null;
  const cur = thisMonth();
  const prev = prevMonth(cur);

  return (
    <div className="py-16">
      <div className="reveal in flex items-center gap-4">
        <Pixel sprite={coin} size={4} className="anim-spin" />
        <h1 className="text-[18px] md:text-[24px]"><span className="px-hl">HI-SCORES</span></h1>
        <Pixel sprite={coin} size={4} className="anim-spin" />
      </div>
      <div className="reveal in mt-8 flex flex-wrap gap-2">
        <Tab href="/leaderboard" active={!season}>All-time · grade</Tab>
        <Tab href={`/leaderboard?season=${cur}`} active={season === cur}>Season · {label(cur)}</Tab>
        <Tab href={`/leaderboard?season=${prev}`} active={season === prev}>{label(prev)}</Tab>
        {season && season !== cur && season !== prev && <Tab href={`/leaderboard?season=${season}`} active>{label(season)}</Tab>}
      </div>
      <p className="mt-6 max-w-2xl text-muted">
        {season
          ? <>Season board: tokens used in {label(season)} (UTC), from per-day history. Resets every month, so newcomers can top it.</>
          : <>Ranked by 30-day grade percentile, then tokens. Opt-in only: every row was uploaded with <code className="text-fg">tokseal login</code> and contains aggregate totals only.</>}
        {DEMO && <span className="ml-2 font-pixel text-[9px] text-coral">[DEMO DATA]</span>}
      </p>
      <div className="reveal in mt-10">
        {season ? <SeasonTable rows={await getSeason(season)} /> : <LeaderboardTable rows={await getLeaderboard(200)} />}
      </div>
    </div>
  );
}
