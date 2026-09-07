/**
 * Parse OpenAI Codex CLI session rollouts into usage events.
 *
 *   ~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<id>.jsonl   ($CODEX_HOME overrides ~/.codex)
 *
 * Two generations of usage records exist and a file may contain either:
 *   - `token_usage_record` (newer): one per API response, with `response_id`
 *     and a per-response `usage` block. Deduped by response_id.
 *   - `token_count` events (older): carry a *cumulative* `total_token_usage`.
 *     The same snapshot is often emitted several times, so we derive events as
 *     deltas between successive cumulative totals rather than summing them.
 * The model comes from the latest `turn_context` seen in the file.
 *
 * OpenAI usage numbers overlap: `cached_input_tokens` is a subset of
 * `input_tokens`, and `reasoning_output_tokens` a subset of `output_tokens`.
 * We split them so every bucket is disjoint and totals stay additive.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { jsonLines, num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function codexBaseDir(): string {
  return process.env.CODEX_HOME || join(homedir(), '.codex');
}

type OaiUsage = {
  input_tokens?: number;
  cached_input_tokens?: number;
  cache_write_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
};

function split(u: OaiUsage) {
  const cached = num(u.cached_input_tokens);
  const cacheWrite = num(u.cache_write_input_tokens);
  const reasoning = num(u.reasoning_output_tokens);
  return {
    input: Math.max(0, num(u.input_tokens) - cached - cacheWrite),
    cacheRead: cached,
    cacheWrite,
    output: Math.max(0, num(u.output_tokens) - reasoning),
    reasoning,
  };
}

async function parseFile(file: string, events: UsageEvent[], seenResponses: Set<string>) {
  let model = '';
  const start = events.length;
  let sessionId = '';
  const pending: UsageEvent[] = []; // token_count deltas, used only if no token_usage_record appears
  let prev: OaiUsage | null = null;
  let sawRecord = false;

  for await (const row of jsonLines(file)) {
    const p = row.payload ?? {};
    switch (row.type) {
      case 'session_meta':
        sessionId = p.session_id || p.id || sessionId;
        if (typeof p.model === 'string') model = p.model;
        break;
      case 'turn_context':
        if (typeof p.model === 'string' && p.model) model = p.model;
        break;
      case 'token_usage_record': {
        const u = p.usage as OaiUsage | undefined;
        if (!u) break;
        sawRecord = true;
        const key = p.response_id || `${file}:${row.ordinal ?? row.timestamp}`;
        if (seenResponses.has(key)) break;
        seenResponses.add(key);
        events.push({ client: 'codex', model, timestamp: row.timestamp || '', sessionId: p.session_id || sessionId, ...split(u) });
        break;
      }
      case 'event_msg': {
        if (p.type !== 'token_count' || !p.info?.total_token_usage) break;
        const cur = p.info.total_token_usage as OaiUsage;
        if (prev) {
          const d: OaiUsage = {
            input_tokens: num(cur.input_tokens) - num(prev.input_tokens),
            cached_input_tokens: num(cur.cached_input_tokens) - num(prev.cached_input_tokens),
            cache_write_input_tokens: num(cur.cache_write_input_tokens) - num(prev.cache_write_input_tokens),
            output_tokens: num(cur.output_tokens) - num(prev.output_tokens),
            reasoning_output_tokens: num(cur.reasoning_output_tokens) - num(prev.reasoning_output_tokens),
          };
          const s = split(d);
          if (s.input + s.cacheRead + s.cacheWrite + s.output + s.reasoning > 0)
            pending.push({ client: 'codex', model, timestamp: row.timestamp || '', sessionId, ...s });
        } else {
          const s = split(cur);
          if (s.input + s.cacheRead + s.cacheWrite + s.output + s.reasoning > 0)
            pending.push({ client: 'codex', model, timestamp: row.timestamp || '', sessionId, ...s });
        }
        prev = cur;
        break;
      }
    }
  }
  if (!sawRecord) events.push(...pending);
  // Usage can precede the first turn_context in a file; backfill with the
  // first model this session reported, which is what those calls used.
  for (let i = start; i < events.length; i++) if (!events[i]!.model) events[i]!.model = model || 'codex-unknown';
}

export async function parseCodex(baseDir = codexBaseDir()): Promise<UsageEvent[]> {
  const files = await walkFiles(join(baseDir, 'sessions'), '.jsonl');
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  for (const f of files) await parseFile(f, events, seen);
  return events;
}
