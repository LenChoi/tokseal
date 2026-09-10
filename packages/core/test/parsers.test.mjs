import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseOpencode, parseCopilot, parseClineTasks, parseAmp, parseDroid, parseKiro,
  importExport, parseImports, estimateTokens, aggregate,
} from '../dist/index.js';

const F = new URL('./fixtures/', import.meta.url).pathname;
const tok = (e) => e.input + e.output + e.cacheRead + e.cacheWrite + e.reasoning;

test('opencode: legacy JSON store, assistant only, deduped by id', async () => {
  const ev = await parseOpencode(join(F, 'opencode'));
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].model, ev[0].input, ev[0].cacheRead, ev[0].cacheWrite, ev[0].timestamp], ['claude-sonnet-4', 1000, 500, 50, '2025-09-04T15:33:20.000Z']);
});

test('copilot: span beats inference log on same trace; input excludes cache reads; string numbers ok', async () => {
  const ev = await parseCopilot(join(F, 'copilot'));
  assert.equal(ev.length, 2);
  const span = ev.find((e) => e.model === 'gpt-5');
  assert.deepEqual([span.input, span.cacheRead, span.output, span.sessionId], [1000, 200, 300, 'conv1']);
  assert.equal(ev.find((e) => e.model === 'gpt-5-mini').input, 100);
});

test('cline family: api_req_started entries, model from history, malformed text skipped', () => {
  const ev = [];
  parseClineTasks('cline', join(F, 'vscode', 'saoudrizwan.claude-dev', 'tasks'), ev);
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].model, ev[0].input, ev[0].output, ev[0].cacheRead, ev[0].cacheWrite, ev[0].sessionId], ['claude-3-7-sonnet', 500, 80, 100, 20, 'task1']);
});

test('amp: ledger event covers message 3; message 5 emitted on its own', async () => {
  const ev = await parseAmp(join(F, 'amp'));
  assert.equal(ev.length, 2);
  assert.equal(ev.reduce((a, e) => a + e.input, 0), 800);
  assert.equal(ev[0].timestamp, '2026-09-04T12:00:00.000Z');
});

test('droid: cumulative total apportioned across assistant turns, sums exactly', async () => {
  const ev = await parseDroid(join(F, 'factory'));
  assert.equal(ev.length, 2);
  assert.equal(ev[0].model, 'claude-opus-4-5-thinking-0');
  assert.deepEqual([ev.reduce((a, e) => a + e.input, 0), ev.reduce((a, e) => a + e.output, 0), ev.reduce((a, e) => a + e.cacheRead, 0), ev.reduce((a, e) => a + e.reasoning, 0)], [1000, 100, 300, 20]);
  assert.ok(ev[1].output > ev[0].output, 'longer turn gets more output');
});

test('kiro: estimated, cumulative context as input, model backfilled from thinking block', async () => {
  const ev = await parseKiro(join(F, 'kiro'));
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.estimated && e.model === 'claude-opus-5'));
  assert.equal(ev[0].input, 100); // 400 chars / 4
  assert.equal(ev[1].input, 100 + 50 + 100); // prompt + prior output + prompt
  const r = aggregate(ev);
  assert.equal(r.totals.totalTokens, 0, 'estimated never enters measured totals');
  assert.equal(r.estimated.totalTokens, ev.reduce((a, e) => a + tok(e), 0));
});

test('imports: claude.ai and ChatGPT exports become estimated events', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tokseal-imports-'));
  process.env.XDG_CONFIG_HOME = dir;
  const a = importExport(join(F, 'imports', 'claude-conversations.json'));
  const b = importExport(join(F, 'imports', 'chatgpt-conversations.json'));
  assert.deepEqual([a.source, a.events, b.source, b.events], ['claude-web', 1, 'chatgpt', 1]);
  const ev = await parseImports(join(dir, 'tokseal', 'imports'));
  assert.equal(ev.length, 2);
  assert.ok(ev.every((e) => e.estimated));
  assert.equal(ev.find((e) => e.client === 'chatgpt').model, 'gpt-4o');
});

test('estimateTokens: CJK denser than latin', () => {
  assert.equal(estimateTokens('a'.repeat(400)), 100);
  assert.equal(estimateTokens('가'.repeat(150)), 100);
});

test('pricing: LiteLLM table, provider prefix stripping, overrides win, unknown is null', async () => {
  const { resolvePrice, setPriceOverrides, costFor } = await import('../dist/index.js');
  assert.deepEqual(resolvePrice('gpt-5.6-sol'), { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 });
  assert.equal(resolvePrice('anthropic/claude-opus-5').input, 5);
  assert.equal(resolvePrice('totally-unknown-9000'), null);
  assert.equal(costFor('totally-unknown-9000', { input: 1e6, output: 0, cacheRead: 0, cacheWrite: 0 }).priced, false);
  setPriceOverrides({ 'totally-unknown-9000': { input: 2, output: 4 } });
  assert.equal(costFor('totally-unknown-9000', { input: 1e6, output: 1e6, cacheRead: 0, cacheWrite: 0 }).cost, 6);
  setPriceOverrides({});
});
