import Link from 'next/link';
import { Pixel } from './pixel/Pixel';
import { seal } from './pixel/sprites';

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b-4 border-line bg-ink/90 backdrop-blur-[2px]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-3 font-pixel text-[13px] tracking-wide">
          <Pixel sprite={seal} size={2} className="anim-bob" /> TOKSEAL
        </Link>
        <nav className="flex items-center gap-6 font-pixel text-[10px] uppercase text-muted">
          <Link href="/leaderboard" className="hover:text-coral">Hi-Scores</Link>
          <a href="https://github.com/LenChoi/tokseal" className="hover:text-coral" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://www.npmjs.com/package/tokseal" className="hidden hover:text-coral sm:inline" target="_blank" rel="noreferrer">npm</a>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="relative mt-24 border-t-4 border-line bg-[#07040f]">
      <div className="h-3 w-full bg-[repeating-linear-gradient(90deg,#3b2a60_0_16px,#24183f_16px_32px)]" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-5 py-10 text-center">
        <p className="font-pixel text-[9px] uppercase tracking-wider text-muted">
          © 2026 Choi Minho · <a className="text-coral" href="https://github.com/LenChoi">@LenChoi</a> · MIT
        </p>
        <p className="text-muted">Local-first. Only aggregate totals are ever uploaded, and only if you opt in.</p>
        <p className="font-pixel text-[9px] text-line-hi">PRESS START ▶ npx tokseal</p>
      </div>
    </footer>
  );
}
