/**
 * Droid (Factory) — ~/.factory/sessions/<id>.settings.json holds a cumulative
 * per-session total that is rewritten in place:
 *   { model, providerLock, providerLockTimestamp, tokenUsage: { inputTokens, outputTokens,
 *     cacheCreationTokens, cacheReadTokens, thinkingTokens } }
 * The sibling <id>.jsonl transcript has timestamps but no token counts, so the
 * total is apportioned across assistant turns by text size (input-side buckets
 * by context accumulated before the turn, output-side by the turn's own size).
 * Without a transcript the total is one event at the file's mtime.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function droidBaseDir(): string {
  return process.env.FACTORY_HOME || join(homedir(), '.factory');
}

export function normalizeDroidModel(m: string): string {
  return m.replace(/^custom:/, '').replace(/\[[^\]]*\]/g, '').replace(/-+$/, '').toLowerCase().replace(/\./g, '-').replace(/-{2,}/g, '-') || 'droid-unknown';
}

export function parseDroidSession(settings: Record<string, any>, transcript: string | null, sessionId: string, mtimeIso: string, events: UsageEvent[]) {
  const u = settings.tokenUsage;
  if (!u) return;
  const total = { input: num(u.inputTokens), output: num(u.outputTokens), cacheWrite: num(u.cacheCreationTokens), cacheRead: num(u.cacheReadTokens), reasoning: num(u.thinkingTokens) };
  if (total.input + total.output + total.cacheWrite + total.cacheRead + total.reasoning === 0) return;
  const model = normalizeDroidModel(String(settings.model ?? ''));

  const turns: Array<{ ts: string; ctx: number; out: number }> = [];
  if (transcript) {
    let ctx = 0;
    for (const line of transcript.split('\n')) {
      if (!line.startsWith('{')) continue;
      let r: Record<string, any>;
      try { r = JSON.parse(line); } catch { continue; }
      if (r.type === 'compaction_state') { ctx = 0; continue; }
      const size = Math.max(1, line.length);
      if (r.type === 'message' && r.message?.role === 'assistant') {
        const t = typeof r.timestamp === 'number' ? new Date(r.timestamp < 1e12 ? r.timestamp * 1000 : r.timestamp) : new Date(r.timestamp ?? '');
        if (!Number.isNaN(t.getTime()) && t.getTime() > 0) turns.push({ ts: t.toISOString(), ctx: Math.max(1, ctx), out: size });
      }
      ctx += size;
    }
  }
  if (turns.length === 0) {
    events.push({ client: 'droid', model, timestamp: mtimeIso, sessionId, ...total });
    return;
  }
  const ctxSum = turns.reduce((a, t) => a + t.ctx, 0);
  const outSum = turns.reduce((a, t) => a + t.out, 0);
  const acc = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0, reasoning: 0 };
  let cCum = 0, oCum = 0;
  for (const t of turns) {
    cCum += t.ctx; oCum += t.out;
    const cf = cCum / ctxSum, of = oCum / outSum;
    const ev = {
      input: Math.round(total.input * cf) - acc.input, cacheRead: Math.round(total.cacheRead * cf) - acc.cacheRead, cacheWrite: Math.round(total.cacheWrite * cf) - acc.cacheWrite,
      output: Math.round(total.output * of) - acc.output, reasoning: Math.round(total.reasoning * of) - acc.reasoning,
    };
    acc.input += ev.input; acc.cacheRead += ev.cacheRead; acc.cacheWrite += ev.cacheWrite; acc.output += ev.output; acc.reasoning += ev.reasoning;
    events.push({ client: 'droid', model, timestamp: t.ts, sessionId, ...ev });
  }
}

export async function parseDroid(baseDir = droidBaseDir()): Promise<UsageEvent[]> {
  const events: UsageEvent[] = [];
  for (const f of await walkFiles(join(baseDir, 'sessions'), '.settings.json', 2)) {
    try {
      const settings = JSON.parse(readFileSync(f, 'utf8'));
      const stem = f.replace(/\.settings\.json$/, '');
      const transcript = existsSync(stem + '.jsonl') && statSync(stem + '.jsonl').size <= 32 * 1024 * 1024 ? readFileSync(stem + '.jsonl', 'utf8') : null;
      parseDroidSession(settings, transcript, basename(stem), statSync(f).mtime.toISOString(), events);
    } catch { /* skip */ }
  }
  return events;
}
