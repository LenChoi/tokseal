/**
 * opencode — ~/.local/share/opencode/opencode*.db (SQLite, v1.2+) and the
 * legacy ~/.local/share/opencode/storage/message/<session>/<msg>.json files.
 *
 * Usage lives in a JSON payload (the `data` column / the file body):
 *   { id, sessionID, role: "assistant", modelID, providerID, cost,
 *     tokens: { input, output, reasoning, cache: { read, write } }, time: { created, completed } }
 * Buckets are disjoint (input excludes cache). `time.created` is epoch ms.
 * Deduped by payload id, which is stable across the JSON → SQLite migration.
 *
 * SQLite is read with node:sqlite (Node ≥ 22.5). When unavailable, only the
 * legacy JSON store is read and the DB is reported as skipped.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function opencodeDataDir(): string {
  return process.env.OPENCODE_DATA_DIR || join(process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share'), 'opencode');
}

function fromPayload(p: Record<string, any>, sessionFallback: string, seen: Set<string>, events: UsageEvent[]) {
  if (!p || typeof p !== 'object') return;
  if (p.role !== undefined && p.role !== 'assistant') return;
  const t = p.tokens;
  if (!t || typeof t !== 'object' || !t.cache || typeof t.cache !== 'object') return;
  const created = p.time?.created;
  if (typeof created !== 'number') return;
  const id = typeof p.id === 'string' ? p.id : '';
  if (id) { if (seen.has(id)) return; seen.add(id); }
  const model = p.modelID || p.model?.id || 'opencode-unknown';
  events.push({
    client: 'opencode', model, timestamp: new Date(created < 1e12 ? created * 1000 : created).toISOString(),
    sessionId: p.sessionID || p.session_id || sessionFallback,
    input: num(t.input), output: num(t.output), cacheRead: num(t.cache.read), cacheWrite: num(t.cache.write), reasoning: num(t.reasoning),
  });
}

async function readDb(file: string, seen: Set<string>, events: UsageEvent[]): Promise<boolean> {
  let sqlite: any;
  try { sqlite = await import('node:sqlite'); } catch { return false; }
  const db = new sqlite.DatabaseSync(file, { readOnly: true });
  try {
    const queries = [
      "select id, session_id, data from session_message where type = 'assistant'",
      'select id, session_id, data from message',
    ];
    for (const q of queries) {
      try {
        for (const row of db.prepare(q).all() as Array<{ id: string; session_id: string; data: string }>) {
          try { fromPayload(JSON.parse(row.data), row.session_id, seen, events); } catch { /* skip row */ }
        }
        return true;
      } catch { /* try next schema */ }
    }
    return false;
  } finally {
    db.close();
  }
}

export async function parseOpencode(dataDir = opencodeDataDir()): Promise<UsageEvent[]> {
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  if (existsSync(dataDir)) {
    for (const f of readdirSync(dataDir)) {
      if (/^opencode(-[a-z0-9]+)?\.db$/.test(f)) await readDb(join(dataDir, f), seen, events);
    }
  }
  for (const f of await walkFiles(join(dataDir, 'storage', 'message'), '.json', 3)) {
    try { fromPayload(JSON.parse(readFileSync(f, 'utf8')), f.split('/').at(-2) ?? '', seen, events); } catch { /* skip */ }
  }
  return events;
}
