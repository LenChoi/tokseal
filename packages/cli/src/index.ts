#!/usr/bin/env node
/**
 * tokseal CLI — read local AI coding usage, print a grade, or emit a card.
 * Everything runs locally; nothing is uploaded unless a future `submit` is run.
 */

import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { parseClaude, aggregate, grade, renderCard, humanTokens } from '@tokseal/core';

type Args = { _: string[]; flags: Record<string, string | boolean> };

function parseArgs(argv: string[]): Args {
  const _: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    } else _.push(a);
  }
  return { _, flags };
}

const money = (n: number) => (n >= 1000 ? '$' + (n / 1000).toFixed(1) + 'K' : '$' + n.toFixed(0));

const GRADE_TINT: Record<string, (s: string) => string> = {
  S: pc.yellow,
  'A+': pc.green,
  A: pc.green,
  'A-': pc.green,
  'B+': pc.cyan,
  B: pc.cyan,
  'B-': pc.blue,
  'C+': pc.magenta,
  C: pc.magenta,
};

function help() {
  console.log(`
${pc.bold('tokseal')} — seal your AI coding usage into a badge

${pc.bold('Usage')}
  tokseal                 Show your usage summary and grade
  tokseal card            Write an SVG card (default: tokseal.svg)
  tokseal --json          Print the full report as JSON

${pc.bold('Options')}
  --json                  Machine-readable output
  --out <file>            Card output path (with 'card')
  --theme <dark|light>    Card theme (default: dark)
  --user <name>           Name shown on the card
  --help                  This help

Data is read locally from ~/.claude/projects and never leaves your machine.
`);
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) return help();

  const report = aggregate(await parseClaude());
  const g = grade(report);

  if (_[0] === 'card') {
    const theme = flags.theme === 'light' ? 'light' : 'dark';
    const out = typeof flags.out === 'string' ? flags.out : 'tokseal.svg';
    const svg = renderCard(report, g, {
      theme,
      username: typeof flags.user === 'string' ? flags.user : undefined,
    });
    writeFileSync(out, svg);
    console.log(pc.green(`✓ wrote ${out}`) + pc.dim(`  (${theme}, grade ${g.level})`));
    return;
  }

  if (flags.json) {
    console.log(JSON.stringify({ report, grade: g }, null, 2));
    return;
  }

  if (report.totals.messageCount === 0) {
    console.log(pc.yellow('No Claude Code usage found under ~/.claude/projects.'));
    console.log(pc.dim('Use Claude Code for a bit, then run tokseal again.'));
    return;
  }

  const tint = GRADE_TINT[g.level] ?? pc.white;
  const t = report.totals;
  console.log();
  console.log(`  ${pc.bold(pc.yellow('◆ tokseal'))}  ${pc.dim(`${report.dateRange.start} → ${report.dateRange.end}`)}`);
  console.log();
  console.log(`  ${pc.dim('Grade')}      ${tint(pc.bold(g.level))}  ${pc.dim(`(top ${g.percentile.toFixed(0)}%)`)}`);
  console.log(`  ${pc.dim('Tokens')}     ${pc.bold(humanTokens(t.totalTokens))}`);
  console.log(`  ${pc.dim('Est. cost')}  ${pc.bold(money(t.cost))}`);
  console.log(`  ${pc.dim('Active')}     ${pc.bold(String(t.activeDays))} days   ${pc.dim('Sessions')} ${pc.bold(String(t.sessionCount))}   ${pc.dim('Messages')} ${pc.bold(humanTokens(t.messageCount))}`);
  console.log();
  console.log(`  ${pc.dim('By model')}`);
  for (const r of report.rows.slice(0, 8)) {
    const bar = money(r.cost).padStart(7);
    const flag = r.priced ? '' : pc.yellow(' (unpriced)');
    console.log(`    ${r.model.padEnd(24)} ${pc.bold(bar)}  ${pc.dim(String(r.messageCount) + ' msgs')}${flag}`);
  }
  console.log();
  console.log(pc.dim('  tokseal card   → make a shareable SVG for your GitHub profile'));
  console.log();
}

main().catch((e) => {
  console.error(pc.red('tokseal failed:'), e?.message ?? e);
  process.exit(1);
});
