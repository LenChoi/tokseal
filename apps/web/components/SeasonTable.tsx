import Link from 'next/link';
import type { SeasonRow } from '@/lib/db';
import { humanTokens, money } from '@/lib/format';
import { Avatar } from './Avatar';

const MEDAL = ['#ffd45e', '#cfd6e6', '#d6905a'];

export function SeasonTable({ rows }: { rows: SeasonRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="px-panel p-10 text-center">
        <p className="font-pixel text-[11px] text-muted">NO SCORES THIS MONTH YET</p>
        <p className="mt-3">Every session end counts: <code className="text-coral">npx tokseal login</code></p>
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
            <th className="px-4 py-4 text-right">Tokens</th>
            <th className="px-4 py-4 text-right">Cost</th>
            <th className="px-4 py-4 text-right">Active days</th>
            <th className="px-4 py-4 text-right">Msgs</th>
            <th className="px-4 py-4 text-right">Sessions</th>
          </tr>
        </thead>
        <tbody className="tnum text-[19px]">
          {rows.map((r) => (
            <tr key={r.login} className="border-t-4 border-[#120b22] hover:bg-[#22163d]">
              <td className="px-4 py-3 font-pixel text-[11px]" style={{ color: MEDAL[r.rank - 1] ?? '#a596c9' }}>{MEDAL[r.rank - 1] ? '★' : ''}{String(r.rank).padStart(2, '0')}</td>
              <td className="px-4 py-3"><Link href={`/u/${r.login}`} className="flex items-center gap-3 hover:text-coral"><Avatar login={r.login} url={r.avatar_url} /><span className="font-pixel text-[11px]">{r.login}</span></Link></td>
              <td className="px-4 py-3 text-right text-gold">{humanTokens(r.tokens)}</td>
              <td className="px-4 py-3 text-right">{money(r.cost)}</td>
              <td className="px-4 py-3 text-right">{r.activeDays}</td>
              <td className="px-4 py-3 text-right">{humanTokens(r.messages)}</td>
              <td className="px-4 py-3 text-right">{humanTokens(r.sessions)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
