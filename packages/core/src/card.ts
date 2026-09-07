/**
 * Render a tokseal card as a self-contained SVG string. No dependencies, no
 * network — safe to run in a serverless function or write to a file locally.
 * The same function powers `tokseal card` and the web `/api/card` endpoint.
 */

import type { UsageReport } from './types.js';
import type { Grade } from './grade.js';
import { pixelText, pixelTextWidth, pixelSprite } from './pixelfont.js';

export type CardTheme = 'dark' | 'light' | 'pixel';

export type CardOptions = {
  username?: string;
  theme?: CardTheme;
  title?: string;
  /** ISO timestamp of the last submission (pixel theme prints "UPDATED 3H AGO"). */
  updatedAt?: string;
};

export function agoLabel(isoTs: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(isoTs)) / 1000);
  if (s < 90) return 'JUST NOW';
  if (s < 3600) return `${Math.round(s / 60)}M AGO`;
  if (s < 86400) return `${Math.round(s / 3600)}H AGO`;
  return `${Math.round(s / 86400)}D AGO`;
}

type Palette = {
  bg: string;
  border: string;
  title: string;
  text: string;
  muted: string;
  accent: string;
  track: string;
};

const THEMES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#0d1117',
    border: '#30363d',
    title: '#f0703c',
    text: '#c9d1d9',
    muted: '#8b949e',
    accent: '#f0703c',
    track: '#21262d',
  },
  light: {
    bg: '#ffffff',
    border: '#e4e2dd',
    title: '#b94f24',
    text: '#1f2328',
    muted: '#656d76',
    accent: '#f0703c',
    track: '#eef0f2',
  },
};

// Grade → ring fill fraction (S fullest) and a color.
const GRADE_META: Record<string, { frac: number; color: string }> = {
  S: { frac: 1.0, color: '#e3b341' },
  'A+': { frac: 0.92, color: '#3fb950' },
  A: { frac: 0.84, color: '#3fb950' },
  'A-': { frac: 0.76, color: '#57ab5a' },
  'B+': { frac: 0.66, color: '#58a6ff' },
  B: { frac: 0.58, color: '#58a6ff' },
  'B-': { frac: 0.5, color: '#6e7bd6' },
  'C+': { frac: 0.4, color: '#a371f7' },
  C: { frac: 0.32, color: '#a371f7' },
};

function esc(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

export function humanTokens(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function humanCost(n: number): string {
  if (n >= 1000) return '$' + (n / 1000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

const W = 470;
const H = 195;

export function renderCard(report: UsageReport, g: Grade, opts: CardOptions = {}): string {
  const theme = opts.theme ?? 'dark';
  if (theme === 'pixel') return renderPixelCard(report, g, opts);
  const p = THEMES[theme];
  const gm = GRADE_META[g.level] ?? GRADE_META.C;
  const title = esc(opts.title ?? (opts.username ? `${opts.username}'s AI usage` : 'AI coding usage'));

  const t = report.totals;
  const stats: Array<[string, string]> = [
    ['Tokens', humanTokens(t.totalTokens)],
    ['Est. cost', humanCost(t.cost)],
    ['Active days', String(t.activeDays)],
    ['Messages', humanTokens(t.messageCount)],
    ['Sessions', humanTokens(t.sessionCount)],
    ['Models', String(report.models.length)],
  ];

  // Grade ring geometry.
  const cx = 380;
  const cy = 100;
  const r = 46;
  const circ = 2 * Math.PI * r;
  const dash = circ * gm.frac;

  const statRows = stats
    .map(([label, value], i) => {
      const col = i % 2;
      const rowIdx = Math.floor(i / 2);
      const x = 32 + col * 150;
      const y = 92 + rowIdx * 30;
      return `
    <text x="${x}" y="${y}" class="lbl">${esc(label)}</text>
    <text x="${x + 118}" y="${y}" class="val" text-anchor="end">${esc(value)}</text>`;
    })
    .join('');

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${title}: grade ${g.level}">
  <style>
    .card { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Pretendard, Helvetica, Arial, sans-serif; }
    .title { font-size: 17px; font-weight: 700; fill: ${p.title}; }
    .sub { font-size: 11px; fill: ${p.muted}; }
    .lbl { font-size: 12.5px; fill: ${p.muted}; }
    .val { font-size: 13.5px; font-weight: 600; fill: ${p.text}; font-variant-numeric: tabular-nums; }
    .grade { font-size: 34px; font-weight: 800; fill: ${gm.color}; }
    .gradeSub { font-size: 10px; fill: ${p.muted}; }
    .seal { font-size: 10px; font-weight: 600; fill: ${p.accent}; letter-spacing: .12em; }
  </style>
  <rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="10" fill="${p.bg}" stroke="${p.border}"/>
  <g class="card">
    <text x="32" y="40" class="title">${title}</text>
    <text x="32" y="58" class="sub">sealed by tokseal · ${esc(report.dateRange.start ?? '')} → ${esc(report.dateRange.end ?? '')}</text>
    ${statRows}
    <text x="32" y="176" class="seal">◆ TOKSEAL</text>

    <g transform="translate(0,0)">
      <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${p.track}" stroke-width="9" fill="none"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${gm.color}" stroke-width="9" fill="none"
        stroke-linecap="round"
        stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ - dash).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="grade">${esc(g.level)}</text>
      <text x="${cx}" y="${cy + 22}" text-anchor="middle" class="gradeSub">top ${g.percentile.toFixed(0)}%</text>
    </g>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Pixel theme: every glyph is drawn as rects from a 5×7 bitmap font, so the
// card looks identical in GitHub READMEs (no web fonts) and stays crisp.
// ---------------------------------------------------------------------------

const PX = {
  bg: '#0b0716',
  panel: '#1a1130',
  line: '#3b2a60',
  lineHi: '#6a4fa3',
  fg: '#f3ecff',
  muted: '#a596c9',
  coral: '#f0703c',
  gold: '#ffd45e',
};

const SEAL_SPRITE = {
  palette: { o: '#9c3e19', c: '#f0703c', h: '#ffa47a', w: '#f3ecff', k: '#0b0716' },
  rows: [
    '.....oooooo.....', '...oocccccccoo..', '..occhhccccccco.', '.occhccccccccco.',
    '.ochcccckkcccco.', 'occcccckwwkcccco', 'occccckwwwwkccco', 'occcckwwwwwwkcco',
    'occcckwwwwwwkcco', 'occccckwwwwkccco', 'occcccckwwkcccco', '.occcccckkccccoo',
    '.occcccccccccoo.', '..occccccccooo..', '...oocccccoo....', '.....oooooo.....',
  ],
};

/** Notched (pixel-corner) rectangle: two overlapping rects. */
function notched(x: number, y: number, w: number, h: number, n: number, fill: string): string {
  return `<rect x="${x + n}" y="${y}" width="${w - 2 * n}" height="${h}" fill="${fill}"/><rect x="${x}" y="${y + n}" width="${w}" height="${h - 2 * n}" fill="${fill}"/>`;
}

function renderPixelCard(report: UsageReport, g: Grade, opts: CardOptions): string {
  const gm = GRADE_META[g.level] ?? GRADE_META.C;
  const t = report.totals;
  const title = (opts.title ?? (opts.username ? opts.username : 'AI CODING USAGE')).toUpperCase().slice(0, 22);
  const sub = `SEALED BY TOKSEAL  ${report.dateRange.start ?? ''} > ${report.dateRange.end ?? ''}`;
  const label = esc(`${title}: grade ${g.level}`);

  const stats: Array<[string, string]> = [
    ['TOKENS', humanTokens(t.totalTokens)],
    ['EST. COST', humanCost(t.cost)],
    ['ACTIVE DAYS', String(t.activeDays)],
    ['MESSAGES', humanTokens(t.messageCount)],
    ['SESSIONS', humanTokens(t.sessionCount)],
    ['MODELS', String(report.models.length)],
  ];

  const parts: string[] = [];
  // frame
  parts.push(notched(0, 0, W, H, 4, PX.line));
  parts.push(notched(4, 4, W - 8, H - 8, 4, PX.bg));
  parts.push(`<rect x="8" y="8" width="${W - 16}" height="4" fill="${PX.lineHi}"/>`); // top bevel
  parts.push(`<rect x="8" y="${H - 12}" width="${W - 16}" height="4" fill="#07040f"/>`); // bottom shadow
  // stripe strip at the very bottom
  for (let x = 8; x < W - 8; x += 16) parts.push(`<rect x="${x}" y="${H - 8}" width="8" height="4" fill="${PX.line}"/>`);

  // header
  parts.push(pixelText(title, 24, 24, 2, PX.coral));
  parts.push(pixelText(sub, 24, 46, 1, PX.muted));
  parts.push(pixelSprite(SEAL_SPRITE.rows, SEAL_SPRITE.palette, W - 24 - 32, 20, 2));

  // stats grid
  stats.forEach(([lbl, val], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 24 + col * 152;
    const y = 74 + row * 30;
    parts.push(pixelText(lbl, x, y + 6, 1, PX.muted));
    const vw = pixelTextWidth(val, 2);
    parts.push(pixelText(val, x + 128 - vw, y, 2, i === 0 ? PX.gold : PX.fg));
  });

  // grade box
  const bx = 340, by = 64, bw = 106, bh = 88;
  parts.push(notched(bx, by, bw, bh, 4, gm.color));
  parts.push(`<rect x="${bx + 4}" y="${by + 4}" width="${bw - 8}" height="4" fill="#ffffff" opacity=".45"/>`);
  parts.push(`<rect x="${bx + 4}" y="${by + bh - 8}" width="${bw - 8}" height="4" fill="#000000" opacity=".35"/>`);
  parts.push(`<rect x="${bx + bw - 8}" y="${by + 4}" width="4" height="${bh - 8}" fill="#000000" opacity=".35"/>`);
  parts.push(notched(bx + 4, by + bh, bw - 8, 6, 2, '#07040f'));
  const gs = 4;
  const gw = pixelTextWidth(g.level, gs);
  parts.push(pixelText(g.level, bx + (bw - gw) / 2, by + 14, gs, PX.bg));
  const top = `TOP ${g.percentile.toFixed(0)}%`;
  parts.push(pixelText(top, bx + (bw - pixelTextWidth(top, 1)) / 2, by + 58, 1, PX.bg));

  // footer
  parts.push(pixelText('◆ TOKSEAL', 24, 166, 1, PX.coral));
  const right = opts.updatedAt ? `UPDATED ${agoLabel(opts.updatedAt)}` : 'TOKSEAL.VERCEL.APP';
  parts.push(pixelText(right, W - 24 - pixelTextWidth(right, 1), 166, 1, PX.muted));

  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${label}" shape-rendering="crispEdges">
${parts.join('\n')}
</svg>`;
}
