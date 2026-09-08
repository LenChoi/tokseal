/** GET /api/card?user=<github login>&theme=dark|light — SVG card from the user's latest submission. */
import { renderCard, reportFromSubmission, gradeFromSubmission } from '@tokseal/core';
import { getUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

const headers = (maxAge: number) => ({
  'content-type': 'image/svg+xml; charset=utf-8',
  'cache-control': `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=86400`,
});

function fallback(msg: string, theme: 'dark' | 'light' | 'pixel') {
  const bg = theme === 'light' ? '#fff' : '#0d1117';
  const fg = theme === 'light' ? '#1f2328' : '#c9d1d9';
  const border = theme === 'light' ? '#e4e2dd' : '#30363d';
  return `<svg width="470" height="195" viewBox="0 0 470 195" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${msg}">
  <rect x="0.5" y="0.5" width="469" height="194" rx="10" fill="${bg}" stroke="${border}"/>
  <text x="32" y="40" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" font-size="17" font-weight="700" fill="#f0703c">tokseal</text>
  <text x="32" y="100" font-family="-apple-system,Segoe UI,Helvetica,Arial,sans-serif" font-size="14" fill="${fg}">${msg}</text>
  <text x="32" y="124" font-family="ui-monospace,Menlo,monospace" font-size="12" fill="#8b949e">npx tokseal login</text>
</svg>`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const user = (url.searchParams.get('user') ?? '').trim();
  const tq = url.searchParams.get('theme');
  const theme = tq === 'light' ? 'light' : tq === 'dark' ? 'dark' : 'pixel';
  const title = url.searchParams.get('title')?.slice(0, 60) ?? undefined;

  if (!user || !/^[a-z0-9-]{1,39}$/i.test(user)) {
    return new Response(fallback('Missing ?user=<github login>', theme), { status: 400, headers: headers(60) });
  }
  const row = await getUser(user);
  if (!row) {
    return new Response(fallback(`@${user} hasn't sealed yet`, theme), { status: 404, headers: headers(300) });
  }
  const svg = renderCard(reportFromSubmission(row.submission), gradeFromSubmission(row.submission), {
    username: row.login,
    theme,
    title,
    updatedAt: row.submittedAt,
  });
  return new Response(svg, { headers: headers(300) });
}
