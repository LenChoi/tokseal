export function Marquee({ items }: { items: string[] }) {
  const row = items.map((t, i) => (
    <span key={i} className="mx-6 font-pixel text-[11px] uppercase tracking-wider text-fg/80">
      {t} <span className="text-coral">◆</span>
    </span>
  ));
  return (
    <div className="marquee border-y-4 border-line bg-panel py-3" aria-hidden>
      <div>{row}{row}</div>
    </div>
  );
}
