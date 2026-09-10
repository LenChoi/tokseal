/**
 * Cline, Roo Code, Kilo Code — VS Code extensions sharing one on-disk layout:
 *   <globalStorage>/<extension-id>/tasks/<taskId>/ui_messages.json
 * ui_messages.json is an array; entries with type "say" and say "api_req_started"
 * carry a `text` field that is itself JSON:
 *   { "tokensIn": n, "tokensOut": n, "cacheReads": n, "cacheWrites": n, "cost": 0.12 }
 * Buckets are disjoint. `ts` is epoch ms. The model id is not on the entry; it
 * is taken from the last <model> tag inside api_conversation_history.json.
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { num } from './jsonl.js';
import type { UsageEvent } from './parse-claude.js';

export const CLINE_FAMILY: Array<{ id: string; name: string; ext: string }> = [
  { id: 'cline', name: 'Cline', ext: 'saoudrizwan.claude-dev' },
  { id: 'roo', name: 'Roo Code', ext: 'rooveterinaryinc.roo-cline' },
  { id: 'kilo', name: 'Kilo Code', ext: 'kilocode.kilo-code' },
];

export function globalStorageRoots(): string[] {
  const h = homedir();
  const roots = [join(h, '.vscode-server', 'data', 'User', 'globalStorage')];
  if (platform() === 'darwin') roots.unshift(join(h, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'));
  else if (platform() === 'win32') roots.unshift(join(process.env.APPDATA ?? join(h, 'AppData', 'Roaming'), 'Code', 'User', 'globalStorage'));
  else roots.unshift(join(process.env.XDG_CONFIG_HOME ?? join(h, '.config'), 'Code', 'User', 'globalStorage'));
  return roots;
}

function modelOf(taskDir: string): string {
  try {
    const hist = readFileSync(join(taskDir, 'api_conversation_history.json'), 'utf8');
    const m = [...hist.matchAll(/<model>([^<]{1,120})<\/model>/g)].at(-1);
    return m?.[1]?.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function parseClineTasks(client: string, tasksDir: string, events: UsageEvent[]) {
  if (!existsSync(tasksDir)) return;
  for (const task of readdirSync(tasksDir)) {
    const dir = join(tasksDir, task);
    let msgs: Array<Record<string, any>>;
    try { msgs = JSON.parse(readFileSync(join(dir, 'ui_messages.json'), 'utf8')); } catch { continue; }
    if (!Array.isArray(msgs)) continue;
    let model = '';
    for (const m of msgs) {
      if (m?.type !== 'say' || m?.say !== 'api_req_started' || typeof m.text !== 'string') continue;
      let u: Record<string, unknown>;
      try { u = JSON.parse(m.text); } catch { continue; }
      const ts = typeof m.ts === 'number' ? new Date(m.ts).toISOString() : typeof m.ts === 'string' ? m.ts : '';
      if (!ts) continue;
      if (!model) model = modelOf(dir);
      events.push({ client, model, timestamp: ts, sessionId: task, input: num(u.tokensIn), output: num(u.tokensOut), cacheRead: num(u.cacheReads), cacheWrite: num(u.cacheWrites), reasoning: 0 });
    }
  }
}

export async function parseClineFamily(id: string, roots = globalStorageRoots()): Promise<UsageEvent[]> {
  const def = CLINE_FAMILY.find((c) => c.id === id);
  if (!def) return [];
  const events: UsageEvent[] = [];
  for (const root of roots) parseClineTasks(id, join(root, def.ext, 'tasks'), events);
  return events;
}
