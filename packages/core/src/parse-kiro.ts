/**
 * Kiro CLI (AWS) — ESTIMATED. Kiro's session logs keep the conversation but
 * record no token usage (turn-level counts are absent in both the JSONL logs
 * and the kiro-cli SQLite store), so tokens are estimated from text length.
 *
 *   ~/.kiro/sessions/cli/<session>.jsonl   (+ <session>.json metadata)
 *   records: { kind: "Prompt" | "AssistantMessage" | "ToolResults" | "Compaction", data: {...} }
 *
 * Model id is only present on `thinking` content items (`modelId`); the last
 * one seen is applied to subsequent turns. Timestamps only exist on Prompt
 * records (unix seconds); assistant turns inherit the latest prompt time.
 *
 * Input per turn = the whole conversation so far (APIs resend the context on
 * every call), reset on Compaction. Output = the assistant turn's text. This
 * mirrors billing more closely than counting only new text, and still
 * undercounts (system prompts and tool schemas are not in the log).
 */

import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import { jsonLines, walkFiles } from './jsonl.js';
import { estimateTokens, textOf } from './estimate.js';
import type { UsageEvent } from './parse-claude.js';

export function kiroBaseDir(): string {
  return process.env.KIRO_HOME || join(homedir(), '.kiro');
}

async function parseFile(file: string, events: UsageEvent[]) {
  const sessionId = basename(file).replace(/\.jsonl$/, '');
  let model = '';
  let ts = '';
  let context = 0; // estimated tokens of everything in the conversation so far
  for await (const row of jsonLines(file)) {
    const data = row.data ?? {};
    const content: Array<Record<string, unknown>> = Array.isArray(data.content) ? data.content : [];
    switch (row.kind) {
      case 'Prompt': {
        const t = data.meta?.timestamp;
        if (typeof t === 'number') ts = new Date(t < 1e12 ? t * 1000 : t).toISOString();
        context += estimateTokens(textOf(content.map((c) => c.data)));
        break;
      }
      case 'ToolResults':
        context += estimateTokens(textOf(data.results ?? content.map((c) => c.data)));
        break;
      case 'Compaction':
        context = estimateTokens(textOf(content.map((c) => c.data)));
        break;
      case 'AssistantMessage': {
        const parts: string[] = [];
        for (const c of content) {
          const d = c.data as Record<string, unknown> | string | undefined;
          if (c.kind === 'thinking' && d && typeof d === 'object' && typeof d.modelId === 'string') model = d.modelId;
          if (c.kind === 'thinking') parts.push(textOf(d && typeof d === 'object' ? (d as Record<string, unknown>).text : d));
          else if (c.kind === 'text' || c.kind === 'toolUse') parts.push(textOf(d));
        }
        const output = estimateTokens(parts.filter(Boolean).join('\n'));
        if (context + output === 0) break;
        events.push({ client: 'kiro', model: model || 'kiro-unknown', timestamp: ts, sessionId, input: context, output, cacheRead: 0, cacheWrite: 0, reasoning: 0, estimated: true });
        context += output;
        break;
      }
    }
  }
}

export async function parseKiro(baseDir = kiroBaseDir()): Promise<UsageEvent[]> {
  const files = await walkFiles(join(baseDir, 'sessions', 'cli'), '.jsonl', 2);
  const events: UsageEvent[] = [];
  for (const f of files) await parseFile(f, events);
  // Backfill model for turns before the first thinking block in a session.
  const firstModel = new Map<string, string>();
  for (const e of events) if (e.model !== 'kiro-unknown' && !firstModel.has(e.sessionId)) firstModel.set(e.sessionId, e.model);
  for (const e of events) if (e.model === 'kiro-unknown' && firstModel.has(e.sessionId)) e.model = firstModel.get(e.sessionId)!;
  return events;
}
