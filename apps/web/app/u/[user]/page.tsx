import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getUser } from '@/lib/db';
import { SITE_URL } from '@/lib/env';
import { humanTokens, money } from '@/lib/format';
import { GradeBadge } from '@/components/GradeBadge';
import { Avatar } from '@/components/Avatar';
import { CopyBlock } from '@/components/CopyBlock';

export const revalidate = 300;

type Props = { params: Promise<{ user: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { user } = await params;
  const row = await getUser(user);
  if (!row) return { title: `@${user}` };
  const s = row.submission;
  return {
    title: `@${row.login} · grade ${s.grade}`,
    description: `${humanTokens(s.totals.totalTokens)} tokens · ${s.totals.activeDays} active days · top ${s.percentile.toFixed(0)}%`,
    openGraph: { images: [`${SITE_URL}/api/card?user=${row.login}&theme=dark`] },
  };
}

export default async function UserPage({ params }: Props) {
  const { user } = await params;
  const row = await getUser(user);
  if (!row) notFound();
  const s = row.submission;
  const t = s.totals;
  const cardUrl = `${SITE_URL}/api/card?user=${row.login}`;

  const stats: Array<[string, string, string]> = [
    ['Tokens', humanTokens(t.totalTokens), 'text-gold'],
    ['Est. cost', money(t.cost), ''],
    ['Active days', String(t.activeDays), ''],
    ['Messages', humanTokens(t.messageCount), ''],
    ['Sessions', humanTokens(t.sessionCount), ''],
    ['Rank', `#${row.rank}`, 'text-coral'],
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
          <p className="mt-1 text-muted">{s.dateRange.start} → {s.dateRange.end} · {s.clients.join(', ')}</p>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <GradeBadge grade={s.grade} size="lg" />
          <div className="font-pixel text-[9px] leading-6 text-muted">TOP<br /><span className="text-[14px] text-fg">{s.percentile.toFixed(1)}%</span></div>
        </div>
      </div>

      <div className="mt-10 grid gap-10 md:grid-cols-[490px_1fr]">
        <div className="reveal in">
          <div className="px-panel relative overflow-hidden p-2 scanlines">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/card?user=${row.login}&theme=pixel`} alt={`${row.login}'s tokseal card`} width={470} height={195} className="h-auto w-full" />
          </div>
          <div className="mt-6 space-y-4">
            <CopyBlock label="Markdown · pixel" text={`![tokseal](${cardUrl}&theme=pixel)`} />
            <CopyBlock label="Markdown · dark" text={`![tokseal](${cardUrl}&theme=dark)`} />
            <CopyBlock label="Markdown · light" text={`![tokseal](${cardUrl}&theme=light)`} />
          </div>
        </div>
        <div className="reveal in" data-delay="1">
          <dl className="grid grid-cols-2 gap-4 tnum sm:grid-cols-3">
            {stats.map(([k, v, c]) => (
              <div key={k} className="px-panel px-4 py-3">
                <dt className="font-pixel text-[8px] uppercase tracking-wider text-muted">{k}</dt>
                <dd className={`mt-2 font-pixel text-[14px] ${c}`}>{v}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-10 font-pixel text-[9px] uppercase tracking-wider text-muted"><i className="px-dot" />By model</p>
          <div className="px-panel mt-4">
            <table className="w-full tnum text-[19px]">
              <tbody>
                {s.models.map((m) => (
                  <tr key={m.client + m.model} className="border-t-4 border-[#120b22] first:border-0">
                    <td className="px-4 py-2 font-pixel text-[9px]">{m.model}</td>
                    <td className="px-4 py-2 text-right text-gold">{humanTokens(m.input + m.output + m.cacheRead + m.cacheWrite + m.reasoning)}</td>
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
