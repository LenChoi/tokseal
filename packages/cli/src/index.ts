#!/usr/bin/env node
/**
 * tokseal CLI — read local AI coding usage, print a grade, or emit a card.
 * Everything runs locally. Only `tokseal submit` talks to the network, and it
 * uploads aggregate totals only (see @tokseal/core toSubmission).
 */

import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { parseClaude, aggregate, grade, renderCard, humanTokens, toSubmission } from '@tokseal/core';
import { DEFAULT_SERVER, configPath, readConfig, writeConfig } from './config.js';

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
  tokseal login           Link this machine to your GitHub account (opt-in)
  tokseal submit          Upload aggregate totals to the leaderboard
  tokseal logout          Forget the stored token
  tokseal --json          Print the full report as JSON

${pc.bold('Options')}
  --json                  Machine-readable output
  --out <file>            Card output path (with 'card')
  --theme <pixel|dark|light>  Card theme (default: pixel)
  --user <name>           Name shown on the card
  --server <url>          Leaderboard server (default: ${DEFAULT_SERVER})
  --help                  This help

Data is read locally from ~/.claude/projects and never leaves your machine
unless you run 'tokseal submit' — and then only totals, never content.
`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function serverFrom(flags: Args['flags']): string {
  const s = typeof flags.server === 'string' ? flags.server : process.env.TOKSEAL_SERVER ?? readConfig().server ?? DEFAULT_SERVER;
  return s.replace(/\/+$/, '');
}

async function login(flags: Args['flags']) {
  const server = serverFrom(flags);
  const start = await fetch(`${server}/api/device/start`, { method: 'POST' });
  if (!start.ok) throw new Error(`server responded ${start.status} at ${server}`);
  const { code, userCode, verifyUrl, interval = 3, expiresIn = 600 } = (await start.json()) as {
    code: string; userCode: string; verifyUrl: string; interval?: number; expiresIn?: number;
  };

  console.log();
  console.log(`  Open ${pc.bold(pc.cyan(verifyUrl))}`);
  console.log(`  and confirm code ${pc.bold(pc.yellow(userCode))}  ${pc.dim('(sign in with GitHub)')}`);
  console.log();
  process.stdout.write(pc.dim('  waiting'));

  const deadline = Date.now() + expiresIn * 1000;
  while (Date.now() < deadline) {
    await sleep(interval * 1000);
    process.stdout.write(pc.dim('.'));
    const res = await fetch(`${server}/api/device/poll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.status === 202) continue;
    if (!res.ok) throw new Error(`login failed (${res.status})`);
    const { token, login: gh } = (await res.json()) as { token: string; login: string };
    writeConfig({ ...readConfig(), server, token, login: gh });
    console.log();
    console.log(pc.green(`  ✓ linked as @${gh}`) + pc.dim(`  (${configPath()})`));
    console.log(pc.dim('  next: tokseal submit'));
    return;
  }
  throw new Error('login timed out — run tokseal login again');
}

async function submit(flags: Args['flags']) {
  const cfg = readConfig();
  const server = serverFrom(flags);
  if (!cfg.token) {
    console.log(pc.yellow('Not linked yet. Run ') + pc.bold('tokseal login') + pc.yellow(' first.'));
    process.exit(1);
  }
  const report = aggregate(await parseClaude());
  const g = grade(report);
  const payload = toSubmission(report, g);

  console.log();
  console.log(`  Uploading ${pc.bold('aggregate totals only')} for @${cfg.login ?? '?'} → ${pc.dim(server)}`);
  console.log(pc.dim(`  grade ${g.level} · ${humanTokens(report.totals.totalTokens)} tokens · ${report.totals.activeDays} days · ${payload.models.length} models`));

  const res = await fetch(`${server}/api/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    console.log(pc.red('  token rejected — run tokseal login again'));
    process.exit(1);
  }
  if (!res.ok) throw new Error(`submit failed (${res.status}): ${await res.text()}`);
  const { profileUrl, cardUrl } = (await res.json()) as { profileUrl: string; cardUrl: string };
  console.log(pc.green('  ✓ sealed'));
  console.log(`  profile  ${pc.cyan(profileUrl)}`);
  console.log(`  card     ${pc.cyan(cardUrl)}`);
  console.log();
  console.log(pc.dim('  Add to your README:'));
  console.log(`  ![tokseal](${cardUrl})`);
  console.log();
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) return help();

  const cmd = _[0];
  if (cmd === 'login') return login(flags);
  if (cmd === 'submit') return submit(flags);
  if (cmd === 'logout') {
    const { token: _t, login: _l, ...rest } = readConfig();
    writeConfig(rest);
    console.log(pc.green('✓ logged out'));
    return;
  }

  const report = aggregate(await parseClaude());
  const g = grade(report);

  if (cmd === 'card') {
    const theme = flags.theme === 'light' ? 'light' : flags.theme === 'dark' ? 'dark' : 'pixel';
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
  console.log(pc.dim('  tokseal card    → make a shareable SVG for your GitHub profile'));
  console.log(pc.dim('  tokseal submit  → opt in to the leaderboard (totals only)'));
  console.log();
}

main().catch((e) => {
  console.error(pc.red('tokseal failed:'), e?.message ?? e);
  process.exit(1);
});
