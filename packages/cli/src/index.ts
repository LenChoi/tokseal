#!/usr/bin/env node
/**
 * tokseal CLI — read local AI coding usage, print a grade, or emit a card.
 * Everything runs locally. Only `tokseal submit` talks to the network, and it
 * uploads aggregate totals only (see @tokseal/core toSubmission).
 */

import { writeFileSync } from 'node:fs';
import pc from 'picocolors';
import { parseAll, aggregate, grade, renderCard, humanTokens, toSubmission, CLIENTS } from '@tokseal/core';
import { createInterface } from 'node:readline/promises';
import { DEFAULT_SERVER, configPath, readConfig, writeConfig } from './config.js';
import { hookInstalled, installHook, uninstallHook, settingsPath } from './hook.js';

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

const VERSION = '0.2.3';

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
  tokseal login           Opt in: link GitHub, install the auto-submit hook, submit
  tokseal submit          Re-upload aggregate totals (the hook does this for you)
  tokseal logout          Forget the stored token and remove the hook
  tokseal hook            Install the Claude Code SessionEnd auto-submit hook
  tokseal hook remove     Remove it
  tokseal --json          Print the full report as JSON

${pc.bold('Options')}
  --json                  Machine-readable output
  --out <file>            Card output path (with 'card')
  --theme <pixel|dark|light>  Card theme (default: pixel)
  --client <ids>          Only these clients, comma-separated (${CLIENTS.map((c) => c.id).join(', ')})
  --user <name>           Name shown on the card
  --server <url>          Leaderboard server (default: ${DEFAULT_SERVER})
  --quiet                 (submit) no output unless it fails
  --debounce <sec>        (submit) skip if last submit was less than N seconds ago
  --yes                   Skip prompts
  --help                  This help

${pc.bold('Clients')} (read locally, never uploaded as content)
${CLIENTS.map((c) => `  ${c.id.padEnd(8)} ${c.name.padEnd(12)} ${pc.dim(c.location())}${c.experimental ? pc.yellow('  experimental') : ''}`).join('\n')}

Nothing leaves your machine unless you run 'tokseal submit', and then only
per-day aggregate counts, never content.
`);
}

const clientsFrom = (flags: Args['flags']) => (typeof flags.client === 'string' ? flags.client.split(',').map((x) => x.trim()).filter(Boolean) : undefined);

async function collectReport(flags: Args['flags']) {
  const { events, found, errors } = await parseAll(clientsFrom(flags));
  for (const [id, err] of Object.entries(errors)) console.error(pc.yellow(`  ! ${id}: ${err}`));
  return { report: aggregate(events), found };
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
    console.log();
    await offerHook(flags);
    // One command does it all: link, hook, first submit.
    await submit(flags);
    return;
  }
  throw new Error('login timed out — run tokseal login again');
}

async function offerHook(flags: Args['flags']) {
  if (hookInstalled()) return;
  let yes = flags.yes === true;
  if (!yes && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const a = await rl.question(`  Auto-submit after every Claude Code session? Adds a SessionEnd hook to ${settingsPath()} ${pc.dim('[Y/n] ')}`);
    rl.close();
    yes = a.trim() === '' || /^y/i.test(a);
  }
  if (!yes) { console.log(pc.dim('  skipped. Later: tokseal hook')); return; }
  const p = installHook();
  console.log(pc.green('  ✓ hook installed') + pc.dim(`  (${p})`));
}

async function submit(flags: Args['flags']) {
  const cfg = readConfig();
  const server = serverFrom(flags);
  const quiet = flags.quiet === true;
  const log = (...a: unknown[]) => { if (!quiet) console.log(...a); };
  if (!cfg.token) {
    if (quiet) return; // hook on a machine that never linked: stay silent
    console.log(pc.yellow('Not linked yet. Run ') + pc.bold('tokseal login') + pc.yellow(' first.'));
    process.exit(1);
  }
  const debounce = typeof flags.debounce === 'string' ? Number(flags.debounce) : 0;
  if (debounce > 0 && cfg.lastSubmitAt && Date.now() - Date.parse(cfg.lastSubmitAt) < debounce * 1000) {
    log(pc.dim(`  submitted ${Math.round((Date.now() - Date.parse(cfg.lastSubmitAt)) / 1000)}s ago; skipping (debounce ${debounce}s)`));
    return;
  }
  const { report, found } = await collectReport(flags);
  const g = grade(report);
  const payload = toSubmission(report, g);

  log();
  log(pc.dim(`  clients: ${found.join(', ') || 'none'}`));
  log(`  Uploading ${pc.bold('aggregate totals only')} for @${cfg.login ?? '?'} → ${pc.dim(server)}`);
  log(pc.dim(`  ${payload.days.length} days · ${humanTokens(report.totals.totalTokens)} tokens · ${payload.models.length} models · no content, no paths`));

  const res = await fetch(`${server}/api/submit`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.token}`, 'x-tokseal-version': VERSION },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    console.log(pc.red('  token rejected — run tokseal login again'));
    process.exit(1);
  }
  if (res.status === 422) {
    const { reasons = [] } = (await res.json()) as { reasons?: string[] };
    console.log(pc.red('  ✗ rejected by plausibility checks:'));
    for (const r of reasons) console.log(pc.dim('    · ' + r));
    process.exit(1);
  }
  if (res.status === 429) { log(pc.dim('  rate limited; try again in a minute')); return; }
  if (!res.ok) throw new Error(`submit failed (${res.status}): ${await res.text()}`);
  const r = (await res.json()) as { profileUrl: string; cardUrl: string; graphUrl: string; grade: string; allTimeTokens: number; streak: number; flags?: string[]; unpricedModels?: string[] };
  if (r.flags?.length) { console.log(pc.yellow('  ! marked UNVERIFIED:')); for (const f of r.flags) console.log(pc.dim('    · ' + f)); }
  if (r.unpricedModels?.length) log(pc.dim(`  unpriced models counted at $0: ${r.unpricedModels.join(', ')}`));
  writeConfig({ ...readConfig(), lastSubmitAt: new Date().toISOString() });
  log(pc.green('  ✓ sealed') + pc.dim(`  grade ${r.grade} · ${humanTokens(r.allTimeTokens)} all-time · ${r.streak}-day streak`));
  log(`  profile  ${pc.cyan(r.profileUrl)}`);
  log(`  graph    ${pc.cyan(r.graphUrl)}`);
  log(`  card     ${pc.cyan(r.cardUrl)}`);
  log();
  log(pc.dim('  Add to your README (badge · card · graph):'));
  log(`  [![tokseal](${server}/badge/${cfg.login})](${r.profileUrl})`);
  log(`  ![tokseal](${r.cardUrl})`);
  log(`  ![tokseal graph](${r.graphUrl})`);
  log();
}

async function main() {
  const { _, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) return help();

  const cmd = _[0];
  if (cmd === 'login') return login(flags);
  if (cmd === 'submit') return submit(flags);
  if (cmd === 'logout') {
    const { token: _t, login: _l, lastSubmitAt: _s, ...rest } = readConfig();
    writeConfig(rest);
    if (hookInstalled()) { uninstallHook(); console.log(pc.dim('  hook removed')); }
    console.log(pc.green('✓ logged out'));
    return;
  }
  if (cmd === 'hook') {
    if (_[1] === 'remove') { const p = uninstallHook(); console.log(pc.green('✓ hook removed') + pc.dim(`  (${p})`)); return; }
    if (hookInstalled()) { console.log(pc.dim(`hook already installed (${settingsPath()})`)); return; }
    await offerHook({ ...flags, yes: true });
    return;
  }

  const { report, found } = await collectReport(flags);
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
    console.log(pc.yellow('No local AI coding usage found.'));
    console.log(pc.dim('Looked in:'));
    for (const c of CLIENTS) console.log(pc.dim(`  ${c.name.padEnd(12)} ${c.location()}`));
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
  console.log(`  ${pc.dim('By client')}`);
  for (const id of found) {
    const rows = report.rows.filter((r) => r.client === id);
    const tok = rows.reduce((a, r) => a + r.input + r.output + r.cacheRead + r.cacheWrite + r.reasoning, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const name = CLIENTS.find((c) => c.id === id)?.name ?? id;
    console.log(`    ${name.padEnd(24)} ${pc.bold(money(cost).padStart(7))}  ${pc.dim(humanTokens(tok) + ' tokens')}`);
  }
  console.log();
  console.log(`  ${pc.dim('By model')}`);
  for (const r of report.rows.slice(0, 10)) {
    const bar = money(r.cost).padStart(7);
    const flag = r.priced ? '' : pc.yellow(' (unpriced)');
    console.log(`    ${pc.dim(r.client.padEnd(7))} ${r.model.padEnd(22)} ${pc.bold(bar)}  ${pc.dim(String(r.messageCount) + ' msgs')}${flag}`);
  }
  console.log();
  const cfg = readConfig();
  if (cfg.token) console.log(pc.dim(`  linked as @${cfg.login} · profile ${serverFrom(flags)}/u/${cfg.login}`));
  else console.log(pc.dim('  npx tokseal login  → GitHub badge + leaderboard in one step (totals only, opt-in)'));
  console.log();
}

main().catch((e) => {
  console.error(pc.red('tokseal failed:'), e?.message ?? e);
  process.exit(1);
});
