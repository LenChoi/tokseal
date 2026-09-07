/**
 * Parse Gemini CLI chat logs (and Qwen Code, a Gemini CLI fork) into events.
 *
 *   Gemini CLI: ~/.gemini/tmp/<project-hash>/chats/session-*.jsonl
 *   Qwen Code:  ~/.qwen/projects/<slug>/chats/*.jsonl        (experimental)
 *
 * Each model turn is one line. Gemini CLI writes
 *   { type: "gemini", model, tokens: { input, output, cached, thoughts, tool, total } }
 * where `input` already includes `cached`. Forks that keep the raw API shape
 * write `usageMetadata: { promptTokenCount, candidatesTokenCount,
 * cachedContentTokenCount, thoughtsTokenCount, toolUsePromptTokenCount }`;
 * both are accepted. Lines are deduped by their `id`/`uuid`.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { jsonLines, num, walkFiles } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export function geminiBaseDir(): string {
  return process.env.GEMINI_CLI_HOME || join(homedir(), '.gemini');
}
export function qwenBaseDir(): string {
  return process.env.QWEN_CODE_HOME || join(homedir(), '.qwen');
}

function tokensFrom(row: Record<string, any>) {
  const t = row.tokens;
  if (t && typeof t === 'object') {
    const cached = num(t.cached);
    return { input: Math.max(0, num(t.input) - cached) + num(t.tool), cacheRead: cached, cacheWrite: 0, output: num(t.output), reasoning: num(t.thoughts) };
  }
  const u = row.usageMetadata ?? row.message?.usageMetadata;
  if (u && typeof u === 'object') {
    const cached = num(u.cachedContentTokenCount);
    return {
      input: Math.max(0, num(u.promptTokenCount) - cached) + num(u.toolUsePromptTokenCount),
      cacheRead: cached, cacheWrite: 0,
      output: num(u.candidatesTokenCount),
      reasoning: num(u.thoughtsTokenCount),
    };
  }
  return null;
}

async function parseFile(file: string, client: string, events: UsageEvent[], seen: Set<string>) {
  let sessionId = '';
  for await (const row of jsonLines(file)) {
    if (!sessionId && typeof row.sessionId === 'string') sessionId = row.sessionId;
    const type = row.type;
    if (type !== 'gemini' && type !== 'assistant' && type !== 'model') continue;
    const tok = tokensFrom(row);
    if (!tok) continue;
    const id = row.id || row.uuid;
    const key = id ? `${client}:${id}` : `${file}:${row.timestamp}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const model = row.model || row.message?.model || `${client}-unknown`;
    events.push({ client, model, timestamp: row.timestamp || '', sessionId: row.sessionId || sessionId || file, ...tok });
  }
}

export async function parseGemini(baseDir = geminiBaseDir()): Promise<UsageEvent[]> {
  const files = (await walkFiles(join(baseDir, 'tmp'), '.jsonl')).filter((f) => f.includes('/chats/'));
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  for (const f of files) await parseFile(f, 'gemini', events, seen);
  return events;
}

export async function parseQwen(baseDir = qwenBaseDir()): Promise<UsageEvent[]> {
  const files = (await walkFiles(join(baseDir, 'projects'), '.jsonl')).filter((f) => f.includes('/chats/'));
  const events: UsageEvent[] = [];
  const seen = new Set<string>();
  for (const f of files) await parseFile(f, 'qwen', events, seen);
  return events;
}
