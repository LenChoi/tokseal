/**
 * Compact badge for READMEs, shields.io-sized. Two styles:
 *   pixel (default): bitmap-font, notched corners, coral label block
 *   flat:            shields-like, system font
 * Everything is drawn with rects/paths so it renders identically anywhere.
 */

import { humanTokens } from './card.js';
import { pixelText, pixelTextWidth } from './pixelfont.js';
import type { Grade } from './grade.js';
import type { Totals } from './types.js';

export type BadgeOptions = {
  style?: 'pixel' | 'flat';
  /** What to show on the right: grade, tokens, streak, or a combination (default "grade,tokens"). */
  metrics?: Array<'grade' | 'tokens' | 'streak' | 'days'>;
  label?: string;
  streak?: number;
};

const GRADE_COLOR: Record<string, string> = {
  S: '#ffd45e', 'A+': '#7ff0c1', A: '#7ff0c1', 'A-': '#7ff0c1',
  'B+': '#7cc4ff', B: '#7cc4ff', 'B-': '#7cc4ff', 'C+': '#c4a5ff', C: '#c4a5ff',
};

function esc(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function valueText(t: Totals, g: Grade, o: BadgeOptions): string {
  const m = o.metrics?.length ? o.metrics : ['grade', 'tokens'];
  const parts: string[] = [];
  for (const k of m) {
    if (k === 'grade') parts.push(g.level);
    if (k === 'tokens') parts.push(humanTokens(t.totalTokens));
    if (k === 'streak') parts.push(`${o.streak ?? 0}D STREAK`);
    if (k === 'days') parts.push(`${t.activeDays}D`);
  }
  return parts.join(' · ');
}

export function renderBadge(t: Totals, g: Grade, opts: BadgeOptions = {}): string {
  const label = (opts.label ?? 'TOKSEAL').toUpperCase().slice(0, 16);
  const value = valueText(t, g, opts).toUpperCase();
  const gc = GRADE_COLOR[g.level] ?? '#a596c9';

  if (opts.style === 'flat') {
    const lw = label.length * 6.6 + 14;
    const vw = value.length * 6.6 + 14;
    const W = Math.round(lw + vw);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="20" role="img" aria-label="${esc(label)}: ${esc(value)}">
<title>${esc(label)}: ${esc(value)}</title>
<clipPath id="r"><rect width="${W}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#f0703c"/><rect x="${lw}" width="${vw}" height="20" fill="#1a1130"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="14" fill="#1a0a04" font-weight="bold">${esc(label)}</text>
<text x="${lw + vw / 2}" y="14" fill="${gc}" font-weight="bold">${esc(value)}</text>
</g></svg>`;
  }

  // pixel style: 28px tall, 5×7 glyphs at scale 2 (10×14 px)
  const s = 2;
  const pad = 10;
  const lw = pixelTextWidth('◆ ' + label, s) + pad * 2;
  const vw = pixelTextWidth(value, s) + pad * 2;
  const W = lw + vw;
  const H = 28;
  const parts: string[] = [];
  // notched frame
  parts.push(`<rect x="2" y="0" width="${W - 4}" height="${H}" fill="#3b2a60"/><rect x="0" y="2" width="${W}" height="${H - 4}" fill="#3b2a60"/>`);
  parts.push(`<rect x="2" y="2" width="${lw - 2}" height="${H - 4}" fill="#f0703c"/>`);
  parts.push(`<rect x="${lw}" y="2" width="${W - lw - 2}" height="${H - 4}" fill="#1a1130"/>`);
  parts.push(`<rect x="2" y="2" width="${lw - 2}" height="2" fill="#ffa47a"/>`); // label bevel
  parts.push(`<rect x="2" y="${H - 4}" width="${W - 4}" height="2" fill="#07040f"/>`); // bottom shadow
  parts.push(pixelText('◆ ' + label, pad, (H - 7 * s) / 2, s, '#1a0a04'));
  parts.push(pixelText(value, lw + pad, (H - 7 * s) / 2, s, gc));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}: ${esc(value)}" shape-rendering="crispEdges">
<title>${esc(label)}: ${esc(value)}</title>
${parts.join('\n')}
</svg>`;
}
