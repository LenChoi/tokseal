# tokseal

**Seal your AI coding usage into a badge.** tokseal reads your local AI coding
sessions, grades how hard you lean on AI, and turns it into a shareable card for
your GitHub profile — proof that you build with AI, at a glance.

> Local-first: your usage is parsed on your machine. Nothing is uploaded unless
> you explicitly opt in to the leaderboard.

<!-- Once the card endpoint is live, this becomes a live image: -->
<!-- ![tokseal card](https://tokseal.dev/api/card?user=LenChoi&theme=dark) -->

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

## Quick start

```bash
npx tokseal            # your usage summary and grade
npx tokseal card       # write an SVG card (tokseal.svg)
npx tokseal --json     # full report as JSON
```

No install, no signup, no API key. tokseal reads `~/.claude/projects` (Claude
Code) directly. Support for more agents (Codex, Gemini, opencode, …) is on the
roadmap.

## The grade

The grade (S → C) blends four local signals so no single number can carry it:

| Signal | Why it counts |
| --- | --- |
| Total tokens | Raw scale of AI-assisted work |
| Active days | Consistency, not a one-off spike |
| Messages | Depth of interaction |
| Sessions | Breadth across projects |

Signals are smoothed with an exponential CDF (the curve
[github-readme-stats](https://github.com/anuraghazra/github-readme-stats) uses
for its rank), so there are no hard cliffs. The percentile is "top X%" — lower
is better.

## Privacy

- Parsing happens **entirely on your machine**, in a few hundred lines of
  dependency-light TypeScript.
- Individual messages and code are **never read for content** — only token
  counts, model ids, and timestamps.
- The leaderboard (coming) is strictly opt-in via `tokseal submit`, and uploads
  only aggregate totals, never message content.

## Packages

| Package | What |
| --- | --- |
| [`@tokseal/core`](packages/core) | Local parser, pricing, aggregation, grading, and the SVG card renderer |
| [`tokseal`](packages/cli) | The CLI |
| `apps/web` | Leaderboard, profiles, and the hosted `/api/card` endpoint (in progress) |

## Roadmap

- [x] Claude Code parser + grade + SVG card + CLI
- [ ] Hosted card endpoint (`/api/card?user=…`) on Vercel
- [ ] Leaderboard + GitHub-login profiles, opt-in `tokseal submit`
- [ ] More agents: Codex, Gemini, opencode, Kiro
- [ ] Custom pricing overrides & themes

## Development

```bash
npm install
npm run build          # builds @tokseal/core then tokseal
node packages/cli/dist/index.js
```

## License

MIT © Choi Minho ([@LenChoi](https://github.com/LenChoi))
