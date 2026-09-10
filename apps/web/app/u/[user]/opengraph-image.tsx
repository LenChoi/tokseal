/** Social preview for /u/<user>: contribution graph + pixel card composed into one 1200×630 PNG. */
import { ImageResponse } from 'next/og';
import { renderCard, renderGraph, reportFromSubmission, gradeFromSubmission } from '@tokseal/core';
import { getUser, getUserDays } from '@/lib/db';

export const alt = 'tokseal AI usage';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 300;

const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

export default async function Image({ params }: { params: Promise<{ user: string }> }) {
  const { user } = await params;
  const [row, hist] = await Promise.all([getUser(user), getUserDays(user)]);
  const bg = '#0b0716';
  if (!row) {
    return new ImageResponse(<div style={{ width: '100%', height: '100%', background: bg, display: 'flex' }} />, size);
  }
  const s = row.submission;
  const end = row.submittedAt.slice(0, 10);
  const graph = renderGraph(hist?.days ?? [], { username: row.login, updatedAt: row.submittedAt, end, weeks: 44 });
  const card = renderCard(reportFromSubmission(s), gradeFromSubmission(s), { username: row.login, theme: 'pixel', updatedAt: row.submittedAt });
  const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="${bg}"/><rect x="0" y="0" width="1200" height="8" fill="#f0703c"/><rect x="0" y="622" width="1200" height="8" fill="#3b2a60"/></svg>`;
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: bg, gap: 24 }}>
        <img src={dataUri(badgeSvg)} width={1200} height={630} style={{ position: 'absolute', top: 0, left: 0 }} />
        <img src={dataUri(graph)} width={1120} height={Math.round(1120 * (172 / 610))} />
        <img src={dataUri(card)} width={800} height={Math.round(800 * (195 / 470))} />
      </div>
    ),
    size,
  );
}
