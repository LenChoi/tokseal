/** Registry of supported local clients. Adding a client = one parser + one row here. */
import { parseClaude, claudeBaseDir } from './parse-claude.js';
import { parseCodex, codexBaseDir } from './parse-codex.js';
import { parseGemini, parseQwen, geminiBaseDir, qwenBaseDir } from './parse-gemini.js';
import { parseKiro, kiroBaseDir } from './parse-kiro.js';
import { parseOpencode, opencodeDataDir } from './parse-opencode.js';
import { parseCopilot, copilotBaseDir } from './parse-copilot.js';
import { parseClineFamily, globalStorageRoots } from './parse-cline.js';
import { parseAmp, ampDataDir } from './parse-amp.js';
import { parseDroid, droidBaseDir } from './parse-droid.js';
import { parseImports, importsDir } from './imports.js';
import type { UsageEvent } from './parse-claude.js';

export type ClientDef = {
  id: string;
  name: string;
  /** Where the logs live, for display. */
  location: () => string;
  parse: () => Promise<UsageEvent[]>;
  experimental?: boolean;
  /** Token counts are estimated from text, not read from a usage block. Shown with "~", never ranked. */
  estimated?: boolean;
};

export const CLIENTS: ClientDef[] = [
  { id: 'claude', name: 'Claude Code', location: () => `${claudeBaseDir()}/projects`, parse: () => parseClaude() },
  { id: 'codex', name: 'Codex CLI', location: () => `${codexBaseDir()}/sessions`, parse: () => parseCodex() },
  { id: 'gemini', name: 'Gemini CLI', location: () => `${geminiBaseDir()}/tmp/*/chats`, parse: () => parseGemini() },
  { id: 'qwen', name: 'Qwen Code', location: () => `${qwenBaseDir()}/projects/*/chats`, parse: () => parseQwen(), experimental: true },
  { id: 'opencode', name: 'opencode', location: () => `${opencodeDataDir()}/opencode*.db`, parse: () => parseOpencode(), experimental: true },
  { id: 'copilot', name: 'Copilot CLI', location: () => `${copilotBaseDir()}/otel/*.jsonl`, parse: () => parseCopilot(), experimental: true },
  { id: 'cline', name: 'Cline', location: () => `${globalStorageRoots()[0]}/saoudrizwan.claude-dev/tasks`, parse: () => parseClineFamily('cline'), experimental: true },
  { id: 'roo', name: 'Roo Code', location: () => `${globalStorageRoots()[0]}/rooveterinaryinc.roo-cline/tasks`, parse: () => parseClineFamily('roo'), experimental: true },
  { id: 'kilo', name: 'Kilo Code', location: () => `${globalStorageRoots()[0]}/kilocode.kilo-code/tasks`, parse: () => parseClineFamily('kilo'), experimental: true },
  { id: 'amp', name: 'Amp', location: () => `${ampDataDir()}/threads`, parse: () => parseAmp(), experimental: true },
  { id: 'droid', name: 'Droid', location: () => `${droidBaseDir()}/sessions`, parse: () => parseDroid(), experimental: true },
  { id: 'kiro', name: 'Kiro CLI', location: () => `${kiroBaseDir()}/sessions/cli`, parse: () => parseKiro(), estimated: true },
  { id: 'imports', name: 'Imports', location: () => importsDir(), parse: () => parseImports(), estimated: true },
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
