'use client';
/** Fake terminal that types `npx tokseal` then prints a result, one line per tick. */
import { useEffect, useState } from 'react';

const CMD = 'npx tokseal';
const OUT = [
  '',
  '  ◆ tokseal  2026-08-02 → 2026-09-07',
  '',
  '  Grade      A-  (top 29%)',
  '  Tokens     14.0B',
  '  Est. cost  $8.3K',
  '  Active     34 days   Sessions 28   Messages 47.2K',
  '',
  '  tokseal submit  → opt in to the leaderboard',
];

export function Typer() {
  const [typed, setTyped] = useState(0);
  const [lines, setLines] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (typed < CMD.length) t = setTimeout(() => setTyped(typed + 1), 70 + Math.random() * 60);
    else if (lines < OUT.length) t = setTimeout(() => setLines(lines + 1), lines === 0 ? 450 : 90);
    return () => clearTimeout(t);
  }, [typed, lines]);
  return (
    <pre className="whitespace-pre-wrap font-body text-[18px] leading-tight text-fg md:text-[20px]">
      <span className="text-mint">$</span> {CMD.slice(0, typed)}
      {typed < CMD.length && <span className="anim-blink">▌</span>}
      {OUT.slice(0, lines).map((l, i) => (
        <div key={i} className={i === 3 ? 'text-gold' : i === 8 ? 'text-muted' : ''}>{l || ' '}</div>
      ))}
      {typed >= CMD.length && lines >= OUT.length && <span className="anim-blink text-mint">$ ▌</span>}
    </pre>
  );
}
