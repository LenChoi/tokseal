/**
 * AI contribution graph — GitHub's green squares, but for tokens per day.
 * Pixel-styled SVG, drawn with rects and the built-in 5×7 bitmap font so it
 * renders identically in a README (no web fonts, no scripts).
 */

import type { DayBucket } from './types.js';
import { humanTokens } from './card.js';
import { pixelText, pixelTextWidth } from './pixelfont.js';

export type GraphOptions = {
  username?: string;
  weeks?: number; // default 52
  /** ISO timestamp of the last submission; rendered as "UPDATED 3H AGO". */
  updatedAt?: string;
  /** End date (YYYY-MM-DD); defaults to today UTC. */
  end?: string;
  theme?: 'pixel' | 'dark' | 'light';
};

const PAL = {
  pixel: { bg: '#0b0716', line: '#3b2a60', lineHi: '#6a4fa3', fg: '#f3ecff', muted: '#a596c9', coral: '#f0703c', gold: '#ffd45e',
    levels: ['#1a1130', '#4a2a2a', '#8a3a1c', '#c85a2a', '#f0703c', '#ffd45e'] },
  dark: { bg: '#0d1117', line: '#30363d', lineHi: '#484f58', fg: '#c9d1d9', muted: '#8b949e', coral: '#f0703c', gold: '#e3b341',
    levels: ['#161b22', '#4a2a2a', '#8a3a1c', '#c85a2a', '#f0703c', '#ffd45e'] },
  light: { bg: '#ffffff', line: '#e4e2dd', lineHi: '#d0cdc7', fg: '#1f2328', muted: '#656d76', coral: '#b94f24', gold: '#9a6700',
    levels: ['#eef0f2', '#fde2d3', '#f9b48f', '#f48a57', '#f0703c', '#b94f24'] },
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAY = 86_400_000;
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function notched(x: number, y: number, w: number, h: number, n: number, fill: string): string {
  return `<rect x="${x + n}" y="${y}" width="${w - 2 * n}" height="${h}" fill="${fill}"/><rect x="${x}" y="${y + n}" width="${w}" height="${h - 2 * n}" fill="${fill}"/>`;
}

function ago(isoTs: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(isoTs)) / 1000);
  if (s < 90) return 'JUST NOW';
  if (s < 3600) return `${Math.round(s / 60)}M AGO`;
  if (s < 86400) return `${Math.round(s / 3600)}H AGO`;
  return `${Math.round(s / 86400)}D AGO`;
}

export function renderGraph(days: DayBucket[], opts: GraphOptions = {}): string {
  const p = PAL[opts.theme ?? 'pixel'];
  const weeks = Math.min(53, Math.max(8, opts.weeks ?? 52));
  const end = opts.end ?? iso(Date.now());
  const endMs = Date.parse(end);
  const endDow = new Date(endMs).getUTCDay(); // 0 = Sun
  // Grid starts on the Sunday `weeks-1` weeks before the week containing `end`.
  const startMs = endMs - endDow * DAY - (weeks - 1) * 7 * DAY;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const tokensOf = (d?: DayBucket) => (d ? d.input + d.output + d.cacheRead + d.cacheWrite + d.reasoning : 0);

  // Level thresholds: quantiles of non-zero days inside the grid.
  const inGrid: number[] = [];
  for (let i = 0; i < weeks * 7; i++) {
    const t = tokensOf(byDate.get(iso(startMs + i * DAY)));
    if (t > 0) inGrid.push(t);
  }
  inGrid.sort((a, b) => a - b);
  const q = (f: number) => inGrid[Math.min(inGrid.length - 1, Math.floor(f * inGrid.length))] ?? 0;
  const cuts = [q(0.2), q(0.4), q(0.6), q(0.8), q(0.95)];
  const levelOf = (t: number) => (t <= 0 ? 0 : 1 + cuts.filter((c) => t > c).length); // 1..6 → clamp 5
  
  // Stats.
  const all = days.reduce((a, d) => a + tokensOf(d), 0);
  const last30 = days.filter((d) => d.date > iso(endMs - 30 * DAY) && d.date <= end).reduce((a, d) => a + tokensOf(d), 0);
  let streak = 0;
  for (let ms = endMs; ; ms -= DAY) {
    const d = byDate.get(iso(ms));
    if (d && d.messageCount > 0) streak++;
    else if (ms === endMs) continue; // today may not be logged yet
    else break;
    if (streak > 3660) break;
  }
  const active = days.filter((d) => d.messageCount > 0).length;

  // Geometry.
  const cell = 9, gap = 3, step = cell + gap;
  const padX = 24, gridX = padX + 22, gridY = 66;
  const W = gridX + weeks * step - gap + padX;
  const H = gridY + 7 * step - gap + 46;

  const parts: string[] = [];
  parts.push(notched(0, 0, W, H, 4, p.line));
  parts.push(notched(4, 4, W - 8, H - 8, 4, p.bg));
  parts.push(`<rect x="8" y="8" width="${W - 16}" height="4" fill="${p.lineHi}"/>`);
  for (let x = 8; x < W - 8; x += 16) parts.push(`<rect x="${x}" y="${H - 8}" width="8" height="4" fill="${p.line}"/>`);

  // Header.
  const title = `${opts.username ? '@' + opts.username : 'AI CONTRIBUTIONS'}`.toUpperCase().slice(0, 24);
  parts.push(pixelText(title, padX, 22, 2, p.coral));
  parts.push(pixelText('AI CONTRIBUTIONS · TOKENS PER DAY', padX, 42, 1, p.muted));
  const stats: Array<[string, string, string]> = [
    ['ALL-TIME', humanTokens(all), p.gold],
    ['LAST 30D', humanTokens(last30), p.fg],
    ['STREAK', `${streak}D`, p.fg],
    ['ACTIVE', `${active}D`, p.fg],
  ];
  let sx = W - padX;
  for (const [lbl, val, col] of [...stats].reverse()) {
    const w = Math.max(pixelTextWidth(lbl, 1), pixelTextWidth(val, 2));
    sx -= w;
    parts.push(pixelText(val, sx + w - pixelTextWidth(val, 2), 20, 2, col));
    parts.push(pixelText(lbl, sx + w - pixelTextWidth(lbl, 1), 40, 1, p.muted));
    sx -= 18;
  }

  // Month labels + cells.
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const ms = startMs + (w * 7 + d) * DAY;
      if (ms > endMs) break;
      const date = iso(ms);
      const m = new Date(ms).getUTCMonth();
      if (d === 0 && m !== lastMonth && w < weeks - 2) {
        lastMonth = m;
        parts.push(pixelText(MONTHS[m]!, gridX + w * step, gridY - 12, 1, p.muted));
      }
      const t = tokensOf(byDate.get(date));
      const lv = Math.min(5, levelOf(t));
      parts.push(`<rect x="${gridX + w * step}" y="${gridY + d * step}" width="${cell}" height="${cell}" fill="${p.levels[lv]}"><title>${date}: ${humanTokens(t)} tokens</title></rect>`);
    }
  }
  // Day labels.
  parts.push(pixelText('M', padX, gridY + 1 * step + 1, 1, p.muted));
  parts.push(pixelText('W', padX, gridY + 3 * step + 1, 1, p.muted));
  parts.push(pixelText('F', padX, gridY + 5 * step + 1, 1, p.muted));

  // Footer: legend + updated.
  const fy = H - 26;
  parts.push(pixelText('◆ TOKSEAL', padX, fy, 1, p.coral));
  let lx = W - padX - 6 * (cell + 2) - pixelTextWidth('MORE', 1) - 6;
  parts.push(pixelText('LESS', lx - pixelTextWidth('LESS', 1) - 6, fy, 1, p.muted));
  for (let i = 0; i < 6; i++) { parts.push(`<rect x="${lx}" y="${fy - 1}" width="${cell}" height="${cell}" fill="${p.levels[i]}"/>`); lx += cell + 2; }
  parts.push(pixelText('MORE', lx + 4, fy, 1, p.muted));
  if (opts.updatedAt) {
    const u = `UPDATED ${ago(opts.updatedAt)}`;
    parts.push(pixelText(u, (W - pixelTextWidth(u, 1)) / 2, fy, 1, p.muted));
  }

  const label = `${title}: ${humanTokens(all)} tokens all-time, ${streak}-day streak`;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" shape-rendering="crispEdges">
${parts.join('\n')}
</svg>`;
}
