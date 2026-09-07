import { Pixel } from './pixel/Pixel';

const PAL = ['#f0703c', '#7ff0c1', '#ffd45e', '#7cc4ff', '#c4a5ff', '#ff7ab6'];

/** Deterministic 8×8 mirrored identicon from the login (used when no avatar URL). */
function identicon(login: string) {
  let h = 2166136261;
  for (const ch of login.toLowerCase()) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const color = PAL[h % PAL.length];
  const rows: string[] = [];
  let bits = h;
  for (let y = 0; y < 8; y++) {
    let half = '';
    for (let x = 0; x < 4; x++) { bits = (Math.imul(bits, 1103515245) + 12345) >>> 0; half += (bits >>> 16) & 1 ? '#' : '.'; }
    rows.push(half + [...half].reverse().join(''));
  }
  return { rows, palette: { '#': color } };
}

export function Avatar({ login, url, size = 28 }: { login: string; url: string | null; size?: number }) {
  const frame = { boxShadow: '0 -2px 0 0 #3b2a60, 0 2px 0 0 #3b2a60, -2px 0 0 0 #3b2a60, 2px 0 0 0 #3b2a60' };
  if (!url) {
    const px = Math.max(2, Math.floor(size / 8));
    return (
      <span className="inline-flex shrink-0 items-center justify-center bg-[#120b22]" style={{ width: size, height: size, ...frame }}>
        <Pixel sprite={identicon(login)} size={px} />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 bg-panel" style={{ imageRendering: 'pixelated', ...frame }} />;
}
