/** GET /api/badge?user=&style=pixel|flat&metrics=grade,tokens,streak,days&label= — compact README badge. */
import { renderBadge, type BadgeOptions } from '@tokseal/core';
import { getUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

const headers = (maxAge: number) => ({
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600`,
});

export async function badgeFor(user: string, sp: URLSearchParams): Promise<Response> {
  const style = sp.get('style') === 'flat' ? 'flat' : 'pixel';
  const label = sp.get('label')?.slice(0, 16) ?? undefined;
  const metrics = (sp.get('metrics') ?? '').split(',').map((m) => m.trim()).filter((m): m is NonNullable<BadgeOptions['metrics']>[number] => ['grade', 'tokens', 'streak', 'days'].includes(m));
  if (!user || !/^[a-z0-9-]{1,39}$/i.test(user)) return new Response('missing user', { status: 400 });
  const row = await getUser(user);
  if (!row) {
    const svg = renderBadge({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, totalTokens: 0, cost: 0, messageCount: 0, activeDays: 0, sessionCount: 0 },
      { level: 'C', percentile: 100, score: 0, windowDays: 30, signals: { tokens: 0, activeDays: 0, messages: 0, sessions: 0 } },
      { style, label: label ?? 'tokseal', metrics: ['grade'] }).replace(/>C</, '>NOT SEALED<');
    return new Response(svg, { status: 404, headers: headers(300) });
  }
  const s = row.submission;
  const svg = renderBadge(s.totals, { level: s.grade, percentile: s.percentile, score: 1 - s.percentile / 100, windowDays: 30, signals: { tokens: 0, activeDays: 0, messages: 0, sessions: 0 } }, {
    style, label, metrics: metrics.length ? metrics : undefined, streak: row.streak,
  });
  return new Response(svg, { headers: headers(300) });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  return badgeFor((url.searchParams.get('user') ?? '').trim(), url.searchParams);
}
