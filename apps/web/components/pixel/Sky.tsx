'use client';
/** Fixed parallax sky: three star layers + drifting pixel clouds. Sets --sy on scroll. */
import { useEffect } from 'react';
import { Pixel } from './Pixel';
import { cloud } from './sprites';

// Deterministic pseudo-random so SSR and client agree.
function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
function stars(seed: number, n: number, size: number, color: string) {
  const r = rng(seed);
  const s: string[] = [];
  for (let i = 0; i < n; i++) s.push(`${(r() * 100).toFixed(2)}vw ${(r() * 220).toFixed(2)}vh 0 0 ${color}`);
  return { width: size, height: size, boxShadow: s.join(',') } as React.CSSProperties;
}

export function Sky() {
  useEffect(() => {
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => document.documentElement.style.setProperty('--sy', String(window.scrollY)));
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => { window.removeEventListener('scroll', on); cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[linear-gradient(180deg,#0b0716_0%,#17102b_45%,#241640_100%)]" aria-hidden>
      <div className="parallax absolute left-0 top-0" style={{ '--speed': 0.05, ...stars(1, 90, 2, '#5d4b86') } as React.CSSProperties} />
      <div className="parallax absolute left-0 top-0" style={{ '--speed': 0.12, ...stars(2, 60, 2, '#a596c9') } as React.CSSProperties} />
      <div className="parallax absolute left-0 top-0" style={{ '--speed': 0.22, animation: 'px-twinkle 2.2s steps(2) infinite', ...stars(3, 30, 3, '#f3ecff') } as React.CSSProperties} />
      <div className="parallax absolute left-0 top-0" style={{ '--speed': 0.22, animation: 'px-twinkle 3.1s steps(2) infinite reverse', ...stars(4, 12, 3, '#ffd45e') } as React.CSSProperties} />

      <div className="parallax absolute left-0 top-[18vh] opacity-70" style={{ '--speed': 0.08, animation: 'px-drift 90s linear infinite' } as React.CSSProperties}><Pixel sprite={cloud} size={6} /></div>
      <div className="parallax absolute left-0 top-[55vh] opacity-50" style={{ '--speed': 0.15, animation: 'px-drift 130s linear -40s infinite' } as React.CSSProperties}><Pixel sprite={cloud} size={4} /></div>
      <div className="parallax absolute left-0 top-[120vh] opacity-60" style={{ '--speed': 0.1, animation: 'px-drift 110s linear -70s infinite' } as React.CSSProperties}><Pixel sprite={cloud} size={5} /></div>
    </div>
  );
}
