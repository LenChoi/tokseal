'use client';
/** Embed panel: pick an asset (badge / card / graph) and copy Markdown or HTML. */
import { useState } from 'react';

type Asset = { key: string; title: string; src: string; alt: string; width?: number };

export function Embed({ login, base }: { login: string; base: string }) {
  const profile = `${base}/u/${login}`;
  const assets: Asset[] = [
    { key: 'badge', title: 'Badge', src: `${base}/badge/${login}`, alt: 'tokseal' },
    { key: 'badge-streak', title: 'Badge · streak', src: `${base}/badge/${login}?metrics=grade,streak`, alt: 'tokseal streak' },
    { key: 'card', title: 'Card', src: `${base}/api/card?user=${login}&theme=pixel`, alt: `${login}'s AI usage` },
    { key: 'graph', title: 'Graph', src: `${base}/api/graph?user=${login}`, alt: 'AI contributions', width: 100 },
  ];
  const [asset, setAsset] = useState(assets[0]!);
  const [fmt, setFmt] = useState<'md' | 'html'>('md');
  const [ok, setOk] = useState(false);

  const code = fmt === 'md'
    ? `[![${asset.alt}](${asset.src})](${profile})`
    : `<a href="${profile}"><img src="${asset.src}" alt="${asset.alt}"${asset.width ? ` width="${asset.width}%"` : ''} /></a>`;

  const copy = async () => { try { await navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); } catch {} };

  return (
    <div className="px-panel px-panel--hi p-5">
      <div className="flex flex-wrap items-center gap-2">
        {assets.map((a) => (
          <button key={a.key} type="button" onClick={() => setAsset(a)}
            className={`px-3 py-2 font-pixel text-[9px] uppercase ${asset.key === a.key ? 'bg-coral text-ink' : 'bg-[#120b22] text-muted hover:text-fg'}`}>
            {a.title}
          </button>
        ))}
        <span className="mx-2 text-line-hi">|</span>
        {(['md', 'html'] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFmt(f)}
            className={`px-3 py-2 font-pixel text-[9px] uppercase ${fmt === f ? 'bg-fg text-ink' : 'bg-[#120b22] text-muted hover:text-fg'}`}>
            {f === 'md' ? 'Markdown' : 'HTML'}
          </button>
        ))}
      </div>
      <div className="mt-4 flex min-h-[44px] items-center justify-center bg-[#120b22] p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset.src.replace(base, '')} alt={asset.alt} className="max-w-full" />
      </div>
      <div className="px-panel mt-4 flex items-stretch overflow-hidden">
        <pre className="min-w-0 flex-1 overflow-x-auto px-4 py-3 font-body text-[17px] text-fg">{code}</pre>
        <button type="button" onClick={copy} className="shrink-0 border-l-4 border-line bg-[#120b22] px-4 font-pixel text-[9px] uppercase text-muted hover:bg-coral hover:text-ink">
          {ok ? 'OK!' : 'copy'}
        </button>
      </div>
      <p className="mt-3 text-muted">Refreshes within ~5 minutes of every submit. Options: <code className="text-fg">?style=flat</code>, <code className="text-fg">?metrics=grade,tokens,streak,days</code>, <code className="text-fg">?label=…</code></p>
    </div>
  );
}
