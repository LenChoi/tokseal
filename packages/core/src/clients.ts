/** Registry of supported local clients. Adding a client = one parser + one row here. */
import { parseClaude, claudeBaseDir } from './parse-claude.js';
import { parseCodex, codexBaseDir } from './parse-codex.js';
import { parseGemini, parseQwen, geminiBaseDir, qwenBaseDir } from './parse-gemini.js';
import type { UsageEvent } from './parse-claude.js';

export type ClientDef = {
  id: string;
  name: string;
  /** Where the logs live, for display. */
  location: () => string;
  parse: () => Promise<UsageEvent[]>;
  experimental?: boolean;
};

export const CLIENTS: ClientDef[] = [
  { id: 'claude', name: 'Claude Code', location: () => `${claudeBaseDir()}/projects`, parse: () => parseClaude() },
  { id: 'codex', name: 'Codex CLI', location: () => `${codexBaseDir()}/sessions`, parse: () => parseCodex() },
  { id: 'gemini', name: 'Gemini CLI', location: () => `${geminiBaseDir()}/tmp/*/chats`, parse: () => parseGemini() },
  { id: 'qwen', name: 'Qwen Code', location: () => `${qwenBaseDir()}/projects/*/chats`, parse: () => parseQwen(), experimental: true },
];

export type ParseAllResult = { events: UsageEvent[]; found: string[]; errors: Record<string, string> };

/** Parse every supported client (or a subset). Never throws: a broken client is reported, not fatal. */
export async function parseAll(only?: string[]): Promise<ParseAllResult> {
  const events: UsageEvent[] = [];
  const found: string[] = [];
  const errors: Record<string, string> = {};
  const defs = only?.length ? CLIENTS.filter((c) => only.includes(c.id)) : CLIENTS;
  await Promise.all(
    defs.map(async (c) => {
      try {
        const ev = await c.parse();
        if (ev.length) { found.push(c.id); events.push(...ev); }
      } catch (e) {
        errors[c.id] = (e as Error)?.message ?? String(e);
      }
    }),
  );
  return { events, found, errors };
}
