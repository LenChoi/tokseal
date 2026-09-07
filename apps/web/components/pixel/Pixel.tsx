/**
 * Tiny pixel-art renderer: rows of characters → one <i> with a box-shadow per pixel.
 * No images, no network, crisp at any scale. Palette maps a char to a color; '.' is transparent.
 */
export type Sprite = { rows: string[]; palette: Record<string, string> };

export function Pixel({ sprite, size = 4, className = '', style }: { sprite: Sprite; size?: number; className?: string; style?: React.CSSProperties }) {
  const shadows: string[] = [];
  sprite.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const c = sprite.palette[ch];
      if (c) shadows.push(`${x * size}px ${y * size}px 0 0 ${c}`);
    });
  });
  const w = Math.max(...sprite.rows.map((r) => r.length)) * size;
  const h = sprite.rows.length * size;
  return (
    <span className={`relative inline-block ${className}`} style={{ width: w, height: h, ...style }} aria-hidden>
      <i className="absolute left-0 top-0 block" style={{ width: size, height: size, boxShadow: shadows.join(','), marginLeft: -size, marginTop: -size, transform: `translate(${size}px,${size}px)` }} />
    </span>
  );
}
