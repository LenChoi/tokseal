# @tokseal/web

Leaderboard, profiles, and the hosted card endpoint. Next.js 16 (App Router) + Tailwind 4 + Supabase.

**Design:** pixel-art arcade. Press Start 2P for headings, VT323 for body, coral `#f0703c` on deep purple.
All sprites are CSS box-shadow pixel art (`components/pixel/Pixel.tsx` + `sprites.ts`), no image files.
Scroll effects: 3-layer star parallax + drifting clouds (`Sky.tsx`, sets `--sy`), stepped `.reveal`
transitions via IntersectionObserver (`Reveal.tsx`), a marquee ticker, and a typing terminal (`Typer.tsx`).
Everything respects `prefers-reduced-motion`.

| Route | What |
| --- | --- |
| `/` | Landing + top 10 |
| `/leaderboard` | Full ranking (percentile asc, tokens desc) |
| `/u/[user]` | Profile: card, stats, per-model table, embed snippets |
| `/api/card?user=&theme=pixel\|dark\|light` | SVG card (same `renderCard` as the CLI; `pixel` default), 30-min cache |
| `/link?code=` | Browser side of `tokseal login` (GitHub sign-in → approve device) |
| `/api/device/start` · `/api/device/poll` · `/api/device/approve` | Device-link flow |
| `/badge/<user>` · `/api/badge?user=` | Compact pixel/flat badge (`?style`, `?metrics`, `?label`), 5-min cache |
| `/api/graph?user=&weeks=52&theme=` | AI contribution graph SVG (tokens per day), 5-min cache |
| `/api/submit` | `Bearer tsk_…` + Submission v2 → merge `usage_days`, recompute all-time, 30-day grade, streak |

Without Supabase env vars the site runs in **demo mode** (fake `demo-*` users, submit/login return 503).

```bash
cp .env.example .env.local   # fill from Supabase → Settings → API
npm run dev -w @tokseal/web
```

See `../../supabase/README.md` for project setup and `../../supabase/migrations` for the schema.

## Deploy (Vercel)

Import the repo, set **Root Directory** to `apps/web`, add the four env vars from `.env.example`.
`prebuild` compiles `@tokseal/core` first, so no extra build command is needed.
