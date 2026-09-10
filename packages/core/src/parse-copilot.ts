/**
 * GitHub Copilot CLI — OpenTelemetry file exporter at ~/.copilot/otel/*.jsonl
 * (plus $COPILOT_OTEL_FILE_EXPORTER_PATH). One JSON record per line; both
 * spans and log records carry an `attributes` object with gen_ai.* keys:
 *   gen_ai.usage.input_tokens (INCLUDES cache reads), gen_ai.usage.output_tokens,
 *   gen_ai.usage.cache_read.input_tokens, gen_ai.usage.cache_write.input_tokens,
 *   gen_ai.usage.reasoning.output_tokens, gen_ai.response.model / gen_ai.request.model
 * A chat span (gen_ai.operation.name = "chat") and an inference log record can
 * describe the same call; the span wins, matched by traceId or response id.
 */

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { jsonLines, num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function copilotBaseDir(): string {
  return process.env.COPILOT_HOME || join(homedir(), '.copilot');
}

const n = (v: unknown) => (typeof v === 'string' ? num(Number(v)) : num(v));
const first = (a: Record<string, unknown>, keys: string[]) => { for (const k of keys) if (a[k] !== undefined) return a[k]; return undefined; };

function tsOf(row: Record<string, any>): string {
  const pair = row.startTime ?? row.endTime ?? row.hrTime ?? row._hrTime;
  if (Array.isArray(pair) && typeof pair[0] === 'number') return new Date(pair[0] * 1000 + (pair[1] ?? 0) / 1e6).toISOString();
  if (typeof row.timestamp === 'number') return new Date(row.timestamp).toISOString();
  if (typeof row.timeUnixNano === 'number') return new Date(row.timeUnixNano / 1e6).toISOString();
  if (typeof row.timestamp === 'string') return row.timestamp;
  return '';
}

async function parseFile(file: string, events: UsageEvent[], seen: Set<string>) {
  type Rec = { kind: 'span' | 'log'; trace: string; resp: string; ev: UsageEvent };
  const recs: Rec[] = [];
  const traceModel = new Map<string, string>();
  for await (const row of jsonLines(file)) {
    const a = (row.attributes ?? {}) as Record<string, unknown>;
    const trace = String(row.traceId ?? row.spanContext?.traceId ?? '');
    const model = String(first(a, ['gen_ai.response.model', 'gen_ai.request.model']) ?? '');
    if (model && trace) traceModel.set(trace, model);
    const op = a['gen_ai.operation.name'];
    const evName = a['event.name'];
    const isSpan = op === 'chat';
    const isLog = evName === 'gen_ai.client.inference.operation.details' || evName === 'copilot_chat.agent.turn';
    if (!isSpan && !isLog) continue;
    const input = n(a['gen_ai.usage.input_tokens']);
    const output = n(a['gen_ai.usage.output_tokens']);
    const cacheRead = n(first(a, ['gen_ai.usage.cache_read.input_tokens', 'gen_ai.usage.cache_read_input_tokens']));
    const cacheWrite = n(first(a, ['gen_ai.usage.cache_write.input_tokens', 'gen_ai.usage.cache_creation.input_tokens', 'gen_ai.usage.cache_write_input_tokens', 'gen_ai.usage.cache_creation_input_tokens']));
    const reasoning = n(first(a, ['gen_ai.usage.reasoning.output_tokens', 'gen_ai.usage.reasoning_tokens']));
    if (input + output + cacheRead + cacheWrite + reasoning === 0) continue;
    const sessionId = String(first(a, ['gen_ai.conversation.id', 'copilot_chat.session_id', 'copilot_chat.chat_session_id', 'session.id']) ?? trace ?? '');
    recs.push({
      kind: isSpan ? 'span' : 'log', trace, resp: String(a['gen_ai.response.id'] ?? ''),
      ev: { client: 'copilot', model, timestamp: tsOf(row), sessionId, input: Math.max(0, input - Math.min(cacheRead, input)), output: Math.max(0, output - reasoning), cacheRead, cacheWrite, reasoning },
    });
  }
  const spanTraces = new Set(recs.filter((r) => r.kind === 'span').map((r) => r.trace).filter(Boolean));
  const spanResps = new Set(recs.filter((r) => r.kind === 'span').map((r) => r.resp).filter(Boolean));
  for (const r of recs) {
    if (r.kind === 'log' && ((r.trace && spanTraces.has(r.trace)) || (r.resp && spanResps.has(r.resp)))) continue;
    if (!r.ev.model) r.ev.model = traceModel.get(r.trace) ?? 'copilot-unknown';
    const key = `${file}:${r.trace}:${r.resp}:${r.ev.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push(r.ev);
  }
}

export async function parseCopilot(baseDir = copilotBaseDir()): Promise<UsageEvent[]> {
  const files = await walkFiles(join(baseDir, 'otel'), '.jsonl', 2);
  const extra = process.env.COPILOT_OTEL_FILE_EXPORTER_PATH;
  if (extra && existsSync(extra) && !files.includes(extra)) files.push(extra);
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  for (const f of files) await parseFile(f, events, seen);
  return events;
}
