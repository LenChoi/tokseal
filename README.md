# tokseal

**Seal your AI coding usage into a badge.** tokseal reads your local AI coding
sessions, grades how hard you lean on AI, and turns it into a shareable card for
your GitHub profile — proof that you build with AI, at a glance.

> Local-first: your usage is parsed on your machine. Nothing is uploaded unless
> you explicitly opt in to the leaderboard.

[![tokseal graph](https://tokseal.vercel.app/api/graph?user=LenChoi)](https://tokseal.vercel.app/u/LenChoi)
[![tokseal card](https://tokseal.vercel.app/api/card?user=LenChoi&theme=pixel)](https://tokseal.vercel.app/u/LenChoi)

[![tokseal badge](https://tokseal.vercel.app/badge/LenChoi)](https://tokseal.vercel.app/u/LenChoi)
[![tokseal streak](https://tokseal.vercel.app/badge/LenChoi?metrics=grade,streak)](https://tokseal.vercel.app/u/LenChoi)

Live from [tokseal.vercel.app](https://tokseal.vercel.app), updated a few minutes after every Claude Code session ends.
Three embeddables: a **badge** (`/badge/<user>`), a **card** (`/api/card`), and a **contribution graph** (`/api/graph`).
Every profile page has an Embed panel with Markdown and HTML snippets.

The card's text is drawn from a built-in 5×7 bitmap font, so it looks
pixel-perfect anywhere an SVG renders, including GitHub READMEs, which strip
external web fonts. Themes: `pixel` (default), `dark`, `light`.

```
  ◆ tokseal  2026-08-02 → 2026-09-07

  Grade      A-  (top 29%)
  Tokens     14.0B
  Est. cost  $8.3K
  Active     34 days   Sessions 28   Messages 47.2K

  By model
    claude-opus-5              $5.8K  31084 msgs
    claude-fable-5             $1.8K  12736 msgs
```

## AI contributions: green squares, but for tokens

Commits measured effort when humans typed every line. tokseal's bet is that the
honest signal now is how much you build *with* AI, so it gives you a per-day
token graph for your README, next to the classic contribution grass.

- **All-time history on the server.** `tokseal submit` uploads per-day
  aggregate counts and the server merges them by date, so your record survives
  Claude Code's default 30-day transcript cleanup.
- **Minutes-fresh README.** `tokseal login` offers to install a Claude Code
  `SessionEnd` hook that re-submits after every session (debounced, silent).
  The graph and card are cached for 5 minutes.
- **A 30-day grade.** The letter is computed over a rolling 30-day window and
  recomputed server-side, so people with different log retention are
  comparable and the client can't just claim an S.
- **Streak.** Consecutive active days, shown on the graph and ranked on the
  hi-score board.

```md
[![tokseal](https://tokseal.vercel.app/badge/LenChoi)](https://tokseal.vercel.app/u/LenChoi)
![tokseal graph](https://tokseal.vercel.app/api/graph?user=LenChoi)
![tokseal](https://tokseal.vercel.app/api/card?user=LenChoi&theme=pixel)
```

Badge options: `?style=flat`, `?metrics=grade,tokens,streak,days`, `?label=…`.

## Quick start

```bash
npx tokseal            # your usage summary and grade (local only)
npx tokseal login      # opt in: GitHub sign-in → auto-submit hook → first submit, in one go
```

That is the whole onboarding. After `login`, every Claude Code session end re-submits
aggregate counts, and your badge, card, and graph stay fresh. Other commands:

```bash
npx tokseal card       # write an SVG card (tokseal.svg)
npx tokseal --json     # full report as JSON
npx tokseal submit     # re-upload now (the hook normally does this)
npx tokseal hook       # (re)install the SessionEnd hook; `hook remove` to undo
npx tokseal logout     # forget the token and remove the hook
```

After `submit`, drop the live card in your README:

```md
![tokseal](https://tokseal.vercel.app/api/card?user=LenChoi&theme=pixel)
```

No install, no signup, no API key. tokseal reads local session logs directly.

## Supported agents

Measured means the log carries a real usage block from the API. Estimated means the
log only has text, so tokens are counted from length; those show with `~` and never
touch your grade or rank. Experimental means written from the documented log format
but not yet verified against real logs on our machines.

| Agent | Reads | Status |
| --- | --- | --- |
| Claude Code | `~/.claude/projects/**/*.jsonl`, `~/.claude/transcripts/` | measured |
| Codex CLI | `~/.codex/sessions/**/*.jsonl` | measured |
| Gemini CLI | `~/.gemini/tmp/*/chats/*.jsonl` | measured |
| Qwen Code | `~/.qwen/projects/*/chats/*.jsonl` | measured · experimental |
| opencode | `~/.local/share/opencode/opencode*.db`, legacy `storage/message/` | measured · experimental |
| GitHub Copilot CLI | `~/.copilot/otel/*.jsonl` | measured · experimental |
| Cline · Roo Code · Kilo Code | VS Code globalStorage `tasks/*/ui_messages.json` | measured · experimental |
| Amp | `~/.local/share/amp/threads/T-*.json` | measured · experimental |
| Droid (Factory) | `~/.factory/sessions/*.settings.json` (+ transcript for timing) | measured · experimental |
| Kiro CLI | `~/.kiro/sessions/cli/*.jsonl` | **estimated** (Kiro logs no token counts) |
| claude.ai / Claude Desktop | `tokseal import <export.zip>` | **estimated** |
| ChatGPT | `tokseal import <export.zip>` | **estimated** |

Every parser is a few dozen lines in [`packages/core/src`](packages/core/src) with a
fixture test in [`packages/core/test`](packages/core/test). If you use an experimental
agent, `npx tokseal --client <id>` and an issue with a redacted sample line is all we
need to promote it. Unknown models are counted at $0 but their tokens still count.

```bash
npx tokseal --client codex,gemini   # limit to some clients
```

## The grade

The grade (S → C) is computed over the **last 30 days** and blends four signals
so no single number can carry it:

| Signal | Why it counts |
| --- | --- |
| Total tokens | Raw scale of AI-assisted work |
| Active days | Consistency, not a one-off spike |
| Messages | Depth of interaction |
| Sessions | Breadth across projects |

Signals are smoothed with an exponential CDF (the curve
[github-readme-stats](https://github.com/anuraghazra/github-readme-stats) uses
for its rank), so there are no hard cliffs. The percentile is "top X%" — lower
is better. Until 50 people are on the board the percentile comes from fixed
medians; after that it is your rank in the real population, re-derived on every
submit and nightly.

## Acknowledgements

- [github-readme-stats](https://github.com/anuraghazra/github-readme-stats) for the
  idea of a stats card in a README and the exponential-CDF rank curve.
- [tokscale](https://github.com/junhoyeo/tokscale) for documenting where fifty-odd
  agents keep their logs. tokseal's parsers are written independently from those
  formats; the two projects differ in scope (tokseal is badge-first, local-first,
  and labels estimated data as estimated).
- [ccusage](https://github.com/ryoppippi/ccusage) for early Claude Code log analysis.
- [LiteLLM](https://github.com/BerriAI/litellm) whose pricing table will back the
  next version of `pricing.ts`.

## Trust model

tokseal numbers are **self-reported**, exactly like a GitHub contribution
graph: the source is a log file on your machine, so no server can prove them.
What the server does instead is make crude forgery fail and subtle forgery
visible:

1. **Repricing.** Cost is recomputed from tokens with the bundled price table.
   The client's cost is discarded.
2. **Physical limits.** Days that are impossible (more tokens per message than
   the largest context window, hundreds of millions of output tokens, tokens
   without messages, future dates) are rejected with a reason.
3. **Plausibility flags.** Implausible days and sudden jumps against your own
   history mark the profile **UNVERIFIED**: still shown, not ranked. A normal
   re-submit from real logs clears it.
4. **Audit log.** Every submit records which days changed and by how much.
5. **One submit per minute** per token.

If a provider ever exposes signed per-user usage, that becomes a "verified"
source; until then the badge says what it is.

## Privacy

- Parsing happens **entirely on your machine**, in a few hundred lines of
  dependency-light TypeScript.
- Individual messages and code are **never read for content** — only token
  counts, model ids, and timestamps.
- The leaderboard is strictly opt-in via `tokseal login`.
  The payload is exactly what `@tokseal/core`'s `toSubmission` produces: totals,
  per-model totals, grade, and a date range. No message content, no file
  paths, no project names, no session ids. It is validated server-side by the
  same `validateSubmission` you can read in the repo.
- `tokseal login` uses a device-link flow: the CLI prints a short code, you
  approve it in the browser after GitHub sign-in, and the CLI stores a token in
  `~/.config/tokseal/config.json`. `tokseal logout` forgets it and removes the hook.
- The auto-submit hook is added to `~/.claude/settings.json` only after you say
  yes. It runs `tokseal submit --quiet --debounce 600` on `SessionEnd`, exits
  silently if this machine was never linked, and never blocks Claude Code.
- Per-day rows are counts only: tokens, cost, messages, sessions. No content,
  no file paths, no project names, no session ids.

## Packages

| Package | What |
| --- | --- |
| [`@tokseal/core`](packages/core) | Local parser, pricing, aggregation, grading, and the SVG card renderer |
| [`tokseal`](packages/cli) | The CLI |
| [`@tokseal/web`](apps/web) | Pixel-art arcade site: hi-scores, `/u/<user>` profiles, `/api/card` endpoint, device-link login (Next.js + Supabase) |

## Roadmap

- [x] Claude Code parser + grade + SVG card + CLI
- [x] Hosted card endpoint (`/api/card?user=…`) + leaderboard + profiles (`apps/web`)
- [x] Opt-in `tokseal login` / `tokseal submit` with GitHub device-link flow
- [x] AI contribution graph (`/api/graph`), per-day history, 30-day grade, streaks, SessionEnd auto-submit hook
- [ ] Deploy: tokseal.vercel.app on Vercel + Supabase, `npm publish`
- [x] More agents: Codex CLI, Gemini CLI, Qwen Code (experimental)
- [x] Trust layer: repricing, physical limits, UNVERIFIED flags, audit log
- [ ] More agents: opencode, Cursor (via export), Copilot CLI
- [ ] Custom pricing overrides & themes

## Development

```bash
npm install
npm run build          # builds @tokseal/core then tokseal
node packages/cli/dist/index.js
npm run dev:web        # web app on :3000 (demo data until Supabase env is set)
```

Point the CLI at a local server with `--server http://localhost:3000` or
`TOKSEAL_SERVER=…`. Supabase setup: [`supabase/README.md`](supabase/README.md).

## License

MIT © Choi Minho ([@LenChoi](https://github.com/LenChoi))
