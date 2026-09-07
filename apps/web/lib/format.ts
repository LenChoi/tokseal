export { humanTokens } from '@tokseal/core';

export const money = (n: number) => (n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n.toFixed(0));

export const GRADE_COLOR: Record<string, string> = {
  S: '#e3b341', 'A+': '#3fb950', A: '#3fb950', 'A-': '#57ab5a',
  'B+': '#58a6ff', B: '#58a6ff', 'B-': '#6e7bd6', 'C+': '#a371f7', C: '#a371f7',
};

export const relDate = (iso: string) => {
  const d = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (d < 1) return 'today';
  if (d < 30) return `${Math.floor(d)}d ago`;
  return new Date(iso).toISOString().slice(0, 10);
};
