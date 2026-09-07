'use client';
import { useState } from 'react';

export function CopyBlock({ text, label }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      {label && <div className="mb-2 font-pixel text-[9px] uppercase tracking-wider text-muted">{label}</div>}
      <div className="px-panel flex items-stretch overflow-hidden">
        <pre className="min-w-0 flex-1 overflow-x-auto px-4 py-3 font-body text-[19px] text-fg"><span className="text-mint">$</span> {text}</pre>
        <button
          type="button"
          onClick={async () => {
            try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {}
          }}
          className="shrink-0 border-l-4 border-line bg-[#120b22] px-4 font-pixel text-[9px] uppercase text-muted hover:bg-coral hover:text-ink"
        >
          {ok ? 'OK!' : 'copy'}
        </button>
      </div>
    </div>
  );
}
