import { GRADE_COLOR } from '@/lib/format';

/** Pixel grade chip: square, bevelled, stepped border. */
export function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'md' | 'lg' }) {
  const c = GRADE_COLOR[grade] ?? '#a596c9';
  const cls = size === 'lg' ? 'h-16 w-16 text-[22px]' : 'h-8 w-8 text-[11px]';
  return (
    <span
      className={`inline-flex ${cls} items-center justify-center font-pixel`}
      style={{
        color: '#0b0716', background: c, margin: 3,
        boxShadow: `0 -3px 0 0 ${c}, 0 3px 0 0 ${c}, -3px 0 0 0 ${c}, 3px 0 0 0 ${c}, inset 0 3px 0 0 #ffffff66, inset -3px -3px 0 0 #00000055, 0 6px 0 0 #07040f`,
      }}
      aria-label={`grade ${grade}`}
    >
      {grade}
    </span>
  );
}
