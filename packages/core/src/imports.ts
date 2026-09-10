/**
 * `tokseal import` — ESTIMATED usage from data exports of chat products that
 * keep no local logs (claude.ai / Claude Desktop, ChatGPT). The export is
 * parsed once, reduced to per-turn token estimates, and the reduced events are
 * stored under ~/.config/tokseal/imports/<name>.json. Message text is read to
 * count characters and then discarded; only counts are kept.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { basename, extname, join } from 'node:path';
import { estimateTokens, textOf } from './estimate.js';
import type { UsageEvent } from './parse-claude.js';

export function importsDir(): string {
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'tokseal', 'imports');
}

type StoredImport = { source: string; importedAt: string; file: string; events: UsageEvent[] };

/** Read conversations.json out of a path that may be a .zip, a .json, or a directory. */
function loadConversations(path: string): unknown {
  const ext = extname(path).toLowerCase();
  if (ext === '.zip') {
    const list = execFileSync('unzip', ['-Z1', path], { encoding: 'utf8' }).split('\n');
    const entry = list.find((l) => /(^|\/)conversations\.json$/.test(l));
    if (!entry) throw new Error('no conversations.json inside the zip');
    return JSON.parse(execFileSync('unzip', ['-p', path, entry], { encoding: 'utf8', maxBuffer: 1 << 30 }));
  }
  if (ext === '.json') return JSON.parse(readFileSync(path, 'utf8'));
  const inner = join(path, 'conversations.json');
  if (existsSync(inner)) return JSON.parse(readFileSync(inner, 'utf8'));
  throw new Error('expected a .zip, a conversations.json, or a folder containing it');
}

/** claude.ai export: [{ uuid, name, chat_messages: [{ uuid, sender: "human"|"assistant", text, content?, created_at }] }] */
function fromClaude(convs: Array<Record<string, any>>): UsageEvent[] {
  const events: UsageEvent[] = [];
  for (const c of convs) {
    const msgs: Array<Record<string, any>> = Array.isArray(c.chat_messages) ? c.chat_messages : [];
    let pending = 0;
    for (const m of msgs) {
      const text = typeof m.text === 'string' && m.text ? m.text : textOf(m.content);
      if (m.sender === 'human') { pending += estimateTokens(text); continue; }
      if (m.sender !== 'assistant') continue;
      events.push({ client: 'claude-web', model: 'claude.ai', timestamp: m.created_at ?? c.created_at ?? '', sessionId: c.uuid ?? '', input: pending, output: estimateTokens(text), cacheRead: 0, cacheWrite: 0, reasoning: 0, estimated: true });
      pending = 0;
    }
  }
  return events;
}

/** ChatGPT export: [{ id, mapping: { [id]: { message?: { author: { role }, content: { parts }, create_time, metadata: { model_slug } } } } }] */
function fromChatGPT(convs: Array<Record<string, any>>): UsageEvent[] {
  const events: UsageEvent[] = [];
  for (const c of convs) {
    const nodes = Object.values((c.mapping ?? {}) as Record<string, any>)
      .map((n) => n?.message)
      .filter((m) => m && m.author && m.content)
      .sort((a, b) => (a.create_time ?? 0) - (b.create_time ?? 0));
    let pending = 0;
    for (const m of nodes) {
      const role = m.author.role;
      const text = textOf(m.content.parts ?? m.content.text ?? '');
      if (role === 'user' || role === 'tool') { pending += estimateTokens(text); continue; }
      if (role !== 'assistant') continue;
      const model = m.metadata?.model_slug || 'chatgpt';
      const ts = typeof m.create_time === 'number' ? new Date(m.create_time * 1000).toISOString() : '';
      events.push({ client: 'chatgpt', model, timestamp: ts, sessionId: c.id ?? c.conversation_id ?? '', input: pending, output: estimateTokens(text), cacheRead: 0, cacheWrite: 0, reasoning: 0, estimated: true });
      pending = 0;
    }
  }
  return events;
}

export function importExport(path: string): { source: string; events: number; stored: string } {
  const data = loadConversations(path);
  if (!Array.isArray(data) || data.length === 0) throw new Error('export contains no conversations');
  const first = data[0] as Record<string, unknown>;
  let source: string;
  let events: UsageEvent[];
  if ('chat_messages' in first) { source = 'claude-web'; events = fromClaude(data); }
  else if ('mapping' in first) { source = 'chatgpt'; events = fromChatGPT(data); }
  else throw new Error('unrecognized export format (expected claude.ai or ChatGPT conversations.json)');
  mkdirSync(importsDir(), { recursive: true });
  const stored = join(importsDir(), `${source}-${basename(path).replace(/\.(zip|json)$/i, '')}.json`);
  const payload: StoredImport = { source, importedAt: new Date().toISOString(), file: basename(path), events };
  writeFileSync(stored, JSON.stringify(payload));
  return { source, events: events.length, stored };
}

/** Events from every stored import. */
export async function parseImports(dir = importsDir()): Promise<UsageEvent[]> {
  if (!existsSync(dir)) return [];
  const out: UsageEvent[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const j = JSON.parse(readFileSync(join(dir, f), 'utf8')) as StoredImport;
      for (const e of j.events) out.push({ ...e, estimated: true });
    } catch { /* skip corrupt import */ }
  }
  return out;
}

export function listImports(dir = importsDir()): Array<{ file: string; source: string; importedAt: string; events: number }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const j = JSON.parse(readFileSync(join(dir, f), 'utf8')) as StoredImport;
    return { file: f, source: j.source, importedAt: j.importedAt, events: j.events.length };
  });
}
