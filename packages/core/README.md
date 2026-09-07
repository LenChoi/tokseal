# @tokseal/core

Local-first parsers (Claude Code, Codex CLI, Gemini CLI, Qwen Code), pricing,
aggregation, a 30-day grade, the pixel SVG card and AI contribution graph, and
the server-side plausibility checks used by [tokseal](https://github.com/LenChoi/tokseal).

```ts
import { collect, grade, renderCard, renderGraph } from '@tokseal/core';
const report = await collect();          // reads local logs only
const g = grade(report);
const svg = renderCard(report, g, { theme: 'pixel', username: 'you' });
```

MIT © Choi Minho
