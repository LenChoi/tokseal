/**
 * Claude Code hook: after every session ends, run `tokseal submit --quiet`
 * so the leaderboard and README card stay minutes-fresh with zero daemons.
 * Writes to ~/.claude/settings.json only with the user's consent.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const settingsPath = () => join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'settings.json');
export const HOOK_MARK = 'tokseal submit';
const COMMAND = 'npx -y tokseal submit --quiet --debounce 600';

type Hooks = Record<string, Array<{ matcher?: string; hooks: Array<{ type: string; command: string; timeout?: number }> }>>;
type Settings = { hooks?: Hooks; [k: string]: unknown };

function read(): Settings {
  const p = settingsPath();
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')) as Settings; } catch { throw new Error(`${p} is not valid JSON; fix it or install the hook manually`); }
}

export function hookInstalled(): boolean {
  const s = read();
  return (s.hooks?.SessionEnd ?? []).some((g) => g.hooks.some((h) => h.command.includes(HOOK_MARK)));
}

export function installHook(): string {
  const s = read();
  s.hooks ??= {};
  s.hooks.SessionEnd ??= [];
  if (!hookInstalled()) {
    s.hooks.SessionEnd.push({ hooks: [{ type: 'command', command: COMMAND, timeout: 60 }] });
  }
  const p = settingsPath();
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
  return p;
}

export function uninstallHook(): string {
  const s = read();
  if (s.hooks?.SessionEnd) {
    s.hooks.SessionEnd = s.hooks.SessionEnd
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !h.command.includes(HOOK_MARK)) }))
      .filter((g) => g.hooks.length > 0);
    if (s.hooks.SessionEnd.length === 0) delete s.hooks.SessionEnd;
    if (Object.keys(s.hooks).length === 0) delete s.hooks;
  }
  const p = settingsPath();
  writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
  return p;
}

export { settingsPath };
