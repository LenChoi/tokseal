/**
 * Render a tokseal card as a self-contained SVG string. No dependencies, no
 * network — safe to run in a serverless function or write to a file locally.
 * The same function powers `tokseal card` and the web `/api/card` endpoint.
 */

import type { UsageReport } from './types.js';
import type { Grade } from './grade.js';

export type CardTheme = 'dark' | 'light';

export type CardOptions = {
  username?: string;
  theme?: CardTheme;
  title?: string;
};

type Palette = {
  bg: string;
  border: string;
  title: string;
  text: string;
  muted: string;
  accent: string;
  track: string;
};

const THEMES: Record<CardTheme, Palette> = {
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
