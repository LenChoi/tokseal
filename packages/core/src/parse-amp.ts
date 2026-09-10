/**
 * Amp (Sourcegraph) — ~/.local/share/amp/threads/T-*.json, one thread per file:
 *   { id, created (epoch ms), messages: [{ role, messageId, usage: { model, inputTokens,
 *     outputTokens, cacheReadInputTokens, cacheCreationInputTokens } }],
 *     usageLedger: { events: [{ timestamp (ISO), model, toMessageId, tokens: {...} }] } }
 * The ledger and the per-message usage describe the same turns; ledger events
 * are preferred (they have real timestamps) and a message is only emitted when
 * no ledger event points at it.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function ampDataDir(): string {
  return process.env.AMP_DATA_DIR || join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'amp');
}

export function parseAmpThread(json: Record<string, any>, fallbackId: string, events: UsageEvent[]) {
  const sessionId = json.id || fallbackId;
  const created = typeof json.created === 'number' ? json.created : Date.now();
  const covered = new Set<number>();
  for (const e of json.usageLedger?.events ?? []) {
    const t = e?.tokens;
    if (!t || !e.model) continue;
    if (typeof e.toMessageId === 'number') covered.add(e.toMessageId);
    const ts = typeof e.timestamp === 'string' && Date.parse(e.timestamp) > 0 ? new Date(e.timestamp).toISOString() : new Date(created).toISOString();
    events.push({ client: 'amp', model: e.model, timestamp: ts, sessionId, input: num(t.input), output: num(t.output), cacheRead: num(t.cacheReadInputTokens), cacheWrite: num(t.cacheCreationInputTokens), reasoning: 0 });
  }
  for (const m of json.messages ?? []) {
    if (m?.role !== 'assistant' || !m.usage?.model) continue;
    if (typeof m.messageId === 'number' && covered.has(m.messageId)) continue;
    const u = m.usage;
    const ts = new Date(created + (typeof m.messageId === 'number' ? m.messageId * 1000 : 0)).toISOString();
    events.push({ client: 'amp', model: u.model, timestamp: ts, sessionId, input: num(u.inputTokens), output: num(u.outputTokens), cacheRead: num(u.cacheReadInputTokens), cacheWrite: num(u.cacheCreationInputTokens), reasoning: 0 });
  }
}

export async function parseAmp(dataDir = ampDataDir()): Promise<UsageEvent[]> {
  const events: UsageEvent[] = [];
  for (const f of await walkFiles(join(dataDir, 'threads'), '.json', 1)) {
    if (!basename(f).startsWith('T-')) continue;
    try { parseAmpThread(JSON.parse(readFileSync(f, 'utf8')), basename(f, '.json'), events); } catch { /* skip */ }
  }
  return events;
}
