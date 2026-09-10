import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { renderGraph, totalsFromDays, windowDays } from '@tokseal/core';
import { getUser, getUserDays } from '@/lib/db';
import { SITE_URL } from '@/lib/env';
import { humanTokens, money, relDate } from '@/lib/format';
import { GradeBadge } from '@/components/GradeBadge';
import { Avatar } from '@/components/Avatar';
import { Embed } from '@/components/Embed';

export const revalidate = 300;

type Props = { params: Promise<{ user: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user } = await params;
  const row = await getUser(user);
  if (!row) return { title: `@${user}` };
  const s = row.submission;
  return {
    title: `@${row.login} · grade ${s.grade}`,
    description: `${humanTokens(row.allTime.tokens)} tokens all-time · ${row.streak}-day streak · top ${s.percentile.toFixed(0)}%`,
    openGraph: { images: [`${SITE_URL}/api/card?user=${row.login}&theme=pixel`] },
  };
}

export default async function UserPage({ params }: Props) {
  const { user } = await params;
  const [row, hist] = await Promise.all([getUser(user), getUserDays(user)]);
  if (!row) notFound();
  const s = row.submission;
  const days = hist?.days ?? [];
  const end = row.submittedAt.slice(0, 10);
  const win = totalsFromDays(windowDays(days, 30, end));
  const graphSvg = renderGraph(days, { username: row.login, updatedAt: row.submittedAt, end });

  const windowStats: Array<[string, string, string]> = [
    ['30d tokens', humanTokens(win.totalTokens), 'text-gold'],
    ['30d cost', money(win.cost), ''],
    ['30d active', `${win.activeDays}/30`, ''],
    ['30d messages', humanTokens(win.messageCount), ''],
    ['30d sessions', humanTokens(win.sessionCount), ''],
    ['Rank', row.flagged ? 'unranked' : `#${row.rank}`, 'text-coral'],
  ];
  const allStats: Array<[string, string]> = [
    ['All-time tokens', humanTokens(row.allTime.tokens)],
    ['All-time cost', money(row.allTime.cost)],
    ['Active days', String(row.allTime.activeDays)],
    ['Streak', `${row.streak}d`],
  ];

  return (
    <div className="py-16">
      <div className="reveal in px-panel px-panel--hi flex flex-wrap items-center gap-5 p-6">
        <Avatar login={row.login} url={row.avatar_url} size={64} />
        <div>
          <p className="font-pixel text-[9px] uppercase tracking-[.25em] text-coral"><i className="px-dot" />player</p>
          <h1 className="mt-2 text-[14px] md:text-[18px]">
            <a href={`https://github.com/${row.login}`} className="hover:text-coral">@{row.login}</a>
          </h1>
          <p className="mt-1 text-muted">since {days[0]?.date ?? s.dateRange.start} · {s.clients.join(', ')} · sealed {relDate(row.submittedAt)}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <GradeBadge grade={s.grade} size="lg" />
          <div className="font-pixel text-[9px] leading-6 text-muted">TOP<br /><span className="text-[14px] text-fg">{s.percentile.toFixed(1)}%</span><br />30-DAY</div>
        </div>
      </div>

      {row.flagged && (
        <div className="reveal in px-panel mt-6 p-5">
          <p className="font-pixel text-[10px] text-coral">⚠ UNVERIFIED</p>
          <p className="mt-2 text-muted">
            This profile is shown but not ranked: the latest submission tripped a plausibility check. Re-running{' '}
            <code className="text-fg">tokseal submit</code> from the real logs clears it.
          </p>
          <ul className="mt-2 list-disc pl-6 text-muted">{row.flagReasons.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}

      {/* Embed */}
      <section className="reveal in mt-10">
        <p className="font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />Embed in your README</p>
        <div className="mt-4"><Embed login={row.login} base={SITE_URL} /></div>
      </section>

      {/* Contribution graph */}
      <section className="reveal in mt-10">
        <p className="font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />AI contributions</p>
        <div className="px-panel mt-4 overflow-x-auto p-2">
          <div className="min-w-[700px] [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: graphSvg }} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {allStats.map(([k, v]) => (
            <div key={k} className="px-panel px-4 py-3">
              <dt className="font-pixel text-[8px] uppercase tracking-wider text-muted">{k}</dt>
              <dd className="mt-2 font-pixel text-[14px]">{v}</dd>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-12 grid gap-10 md:grid-cols-[490px_1fr]">
        <div className="reveal in">
          <p className="font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />Card</p>
          <div className="px-panel relative mt-4 overflow-hidden p-2 scanlines">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/card?user=${row.login}&theme=pixel`} alt={`${row.login}'s tokseal card`} width={470} height={195} className="h-auto w-full" />
          </div>
          <p className="mt-4 text-muted">Themes: <code className="text-fg">?theme=pixel|dark|light</code>. Copy snippets from the Embed panel above.</p>
        </div>
        <div className="reveal in" data-delay="1">
          <p className="font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />Last 30 days (grade window)</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 tnum sm:grid-cols-3">
            {windowStats.map(([k, v, c]) => (
              <div key={k} className="px-panel px-4 py-3">
                <dt className="font-pixel text-[8px] uppercase tracking-wider text-muted">{k}</dt>
                <dd className={`mt-2 font-pixel text-[14px] ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>

          {s.estimated && s.estimated.totalTokens > 0 && (
            <div className="px-panel mt-6 px-4 py-3">
              <dt className="font-pixel text-[8px] uppercase tracking-wider text-muted">Estimated · not ranked</dt>
              <dd className="mt-2 font-pixel text-[14px] text-muted">~{humanTokens(s.estimated.totalTokens)} <span className="text-[9px]">· ~{money(s.estimated.cost)} · {s.estimated.activeDays} days</span></dd>
              <p className="mt-1 text-muted">From sources that log text but no usage (Kiro, imports). Counted from length, shown for context only.</p>
            </div>
          )}

          <p className="mt-10 font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />By model (latest submit)</p>
          <div className="px-panel mt-4">
            <table className="w-full tnum text-[19px]">
              <tbody>
                {s.models.map((m) => (
                  <tr key={m.client + m.model} className="border-t-4 border-[#120b22] first:border-0">
                    <td className="px-4 py-2 font-pixel text-[9px]">{m.model}{m.estimated && <span className="ml-2 text-muted">~est</span>}</td>
                    <td className={`px-4 py-2 text-right ${m.estimated ? 'text-muted' : 'text-gold'}`}>{m.estimated ? '~' : ''}{humanTokens(m.input + m.output + m.cacheRead + m.cacheWrite + m.reasoning)}</td>
                    <td className="px-4 py-2 text-right">{money(m.cost)}</td>
                    <td className="px-4 py-2 text-right text-muted">{humanTokens(m.messageCount)} msgs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
