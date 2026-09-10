/**
 * Parse Claude Code local transcripts into usage events.
 *
 * Claude Code writes newline-delimited JSON to
 *   ~/.claude/projects/<slug>/<sessionId>.jsonl
 * (override the base dir with $CLAUDE_CONFIG_DIR). Every assistant turn is one
 * line with `message.model` and `message.usage`. We read line-by-line so large
 * histories never load fully into memory, and dedupe by message id so resumed
 * sessions (which replay earlier lines) are not double-counted.
 *
 * Nothing here leaves the machine — this is pure local file reading.
 */

import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type UsageEvent = {
  client: string;
  model: string;
  timestamp: string; // ISO
  sessionId: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning: number;
  /** Set by estimated-only parsers. Measured sources leave it undefined. */
  estimated?: boolean;
};

const SYNTHETIC = new Set(['<synthetic>', 'synthetic', '']);

export function claudeBaseDir(): string {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

async function walkJsonl(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkJsonl(p)));
    else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
  }
  return out;
}

async function parseFile(file: string, seen: Set<string>, events: UsageEvent[]) {
  const rl = createInterface({
    input: createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    let row: any;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    if (row.type !== 'assistant') continue;
    const msg = row.message;
    if (!msg || typeof msg !== 'object') continue;
    const model: string = msg.model || '';
    if (SYNTHETIC.has(model)) continue;
    const u = msg.usage;
    if (!u) continue;

    // Dedupe: a message id (falling back to requestId) is unique per API call.
    const dedupeKey = `${msg.id ?? ''}:${row.requestId ?? ''}`;
    if (dedupeKey !== ':' && seen.has(dedupeKey)) continue;
    if (dedupeKey !== ':') seen.add(dedupeKey);

    events.push({
      client: 'claude',
      model,
      timestamp: row.timestamp || '',
      sessionId: row.sessionId || row.session_id || '',
      input: u.input_tokens || 0,
      output: u.output_tokens || 0,
      cacheRead: u.cache_read_input_tokens || 0,
      cacheWrite: u.cache_creation_input_tokens || 0,
      reasoning: 0, // Claude folds reasoning into output tokens.
    });
  }
}

export async function parseClaude(baseDir = claudeBaseDir()): Promise<UsageEvent[]> {
  // `transcripts/` mirrors turns that also live under `projects/`; the
  // message-id:request-id dedupe key is shared across both, so reading them in
  // one pass with one `seen` set collapses the overlap.
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  for (const sub of ['projects', 'transcripts']) {
    const dir = join(baseDir, sub);
    try { await stat(dir); } catch { continue; }
    for (const f of await walkJsonl(dir)) {
      if (f.endsWith('journal.jsonl')) continue; // orchestration metadata, never usage
      await parseFile(f, seen, events);
    }
  }
  return events;
}
