/** GET /api/graph?user=&weeks=52&theme=pixel|dark|light — AI contribution graph SVG. */
import { renderGraph } from '@tokseal/core';
import { getUserDays } from '@/lib/db';

export const dynamic = 'force-dynamic';

const headers = (maxAge: number) => ({
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=3600`,
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = (url.searchParams.get('user') ?? '').trim();
  const tq = url.searchParams.get('theme');
  const theme = tq === 'light' ? 'light' : tq === 'dark' ? 'dark' : 'pixel';
  const weeks = Math.min(53, Math.max(8, Number(url.searchParams.get('weeks') ?? 52) || 52));
  if (!user || !/^[a-z0-9-]{1,39}$/i.test(user)) return new Response('missing ?user=', { status: 400 });

  const row = await getUserDays(user);
  if (!row) {
    const svg = renderGraph([], { username: user, weeks, theme });
    return new Response(svg, { status: 404, headers: headers(300) });
  }
  const svg = renderGraph(row.days, { username: row.login, weeks, theme, updatedAt: row.updatedAt ?? undefined });
  return new Response(svg, { headers: headers(300) });
}
