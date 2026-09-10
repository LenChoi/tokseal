/**
 * Token estimation for sources that log text but not usage. Deliberately
 * simple and conservative: ~4 chars per token for Latin text, ~1.5 for CJK
 * (which tokenizes far denser). Anything produced from here carries
 * `estimated: true` and is shown with "~", never ranked.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if ((c >= 0x3040 && c <= 0x30ff) || (c >= 0x4e00 && c <= 0x9fff) || (c >= 0xac00 && c <= 0xd7af)) cjk++;
  }
  const other = [...text].length - cjk;
  return Math.ceil(other / 4 + cjk / 1.5);
}

/** Flatten arbitrary content (string | array | object) to text for estimation. */
export function textOf(v: unknown, depth = 0): string {
  if (v == null || depth > 6) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map((x) => textOf(x, depth + 1)).join('\n');
  if (typeof v === 'object') return Object.values(v as Record<string, unknown>).map((x) => textOf(x, depth + 1)).join('\n');
  return '';
}
