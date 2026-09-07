import Link from 'next/link';
import type { LeaderboardRow } from '@/lib/db';
import { humanTokens, money, relDate } from '@/lib/format';
import { GradeBadge } from './GradeBadge';
import { Avatar } from './Avatar';

const MEDAL = ['#ffd45e', '#cfd6e6', '#d6905a'];

/** Arcade "HI-SCORES" board. */
export function LeaderboardTable({ rows, compact = false }: { rows: LeaderboardRow[]; compact?: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="px-panel p-10 text-center">
        <p className="font-pixel text-[11px] text-muted">NO SCORES YET</p>
        <p className="mt-3">Be the first: <code className="text-coral">npx tokseal submit</code></p>
      </div>
    );
  }
  return (
    <div className="px-panel overflow-x-auto">
      <table className="w-full">
        <thead className="bg-[#120b22] font-pixel text-[9px] uppercase tracking-wider text-muted">
          <tr>
            <th className="px-4 py-4 text-left">Rank</th>
            <th className="px-4 py-4 text-left">Player</th>
            <th className="px-4 py-4 text-left">Grade</th>
            <th className="px-4 py-4 text-right">30d tokens</th>
            <th className="px-4 py-4 text-right">All-time</th>
            {!compact && <th className="px-4 py-4 text-right">Streak</th>}
            {!compact && <th className="px-4 py-4 text-right">Days</th>}
            {!compact && <th className="px-4 py-4 text-right">Sealed</th>}
          </tr>
        </thead>
        <tbody className="tnum text-[19px]">
          {rows.map((r, i) => {
            const win = r.submission.days.length
              ? r.submission.days.filter((d) => d.date > new Date(Date.parse(r.submittedAt) - 30 * 86_400_000).toISOString().slice(0, 10)).reduce((a, d) => a + d.input + d.output + d.cacheRead + d.cacheWrite + d.reasoning, 0)
              : r.submission.totals.totalTokens;
            const medal = r.flagged ? undefined : MEDAL[r.rank - 1];
            return (
              <tr key={r.login} className={`border-t-4 border-[#120b22] hover:bg-[#22163d] ${r.flagged ? 'opacity-60' : ''}`}>
                <td className="px-4 py-3 font-pixel text-[11px]" style={{ color: r.flagged ? '#a596c9' : medal ?? '#a596c9' }}>
                  {r.flagged ? '??' : `${medal ? '★' : ''}${String(r.rank).padStart(2, '0')}`}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/u/${r.login}`} className="flex items-center gap-3 hover:text-coral">
                    <Avatar login={r.login} url={r.avatar_url} />
                    <span className="font-pixel text-[11px]">{r.login}</span>
                    {r.flagged && <span className="font-pixel text-[8px] text-coral" title={r.flagReasons.join('\n')}>UNVERIFIED</span>}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-3">
                    <GradeBadge grade={r.submission.grade} />
                    <span className="text-muted">top {r.submission.percentile.toFixed(0)}%</span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gold">{humanTokens(win)}</td>
                <td className="px-4 py-3 text-right">{humanTokens(r.allTime.tokens)} <span className="text-muted">· {money(r.allTime.cost)}</span></td>
                {!compact && <td className="px-4 py-3 text-right">{r.streak > 0 ? <span className="text-coral">🔥{r.streak}d</span> : <span className="text-muted">–</span>}</td>}
                {!compact && <td className="px-4 py-3 text-right">{r.allTime.activeDays}</td>}
                {!compact && <td className="px-4 py-3 text-right text-muted">{relDate(r.submittedAt)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
