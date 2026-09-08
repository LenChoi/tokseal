import Link from 'next/link';
import { Pixel } from '@/components/pixel/Pixel';
import { robot } from '@/components/pixel/sprites';
export default function NotFound() {
  return (
    <div className="py-28 text-center">
      <Pixel sprite={robot} size={6} className="anim-bob" />
      <h1 className="mt-8 text-[16px] md:text-[22px]"><span className="px-hl">GAME OVER?</span></h1>
      <p className="mt-6 text-muted">This player hasn&apos;t sealed yet.</p>
      <pre className="px-panel mx-auto mt-6 inline-block px-5 py-3 text-left text-[19px]"><span className="text-mint">$</span> npx tokseal login</pre>
      <p className="mt-8"><Link href="/leaderboard" className="px-btn px-btn--ghost">← HI-SCORES</Link></p>
    </div>
  );
}
