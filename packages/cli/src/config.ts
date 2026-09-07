/** Tiny config store at ~/.config/tokseal/config.json (token + server). */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Config = { server?: string; token?: string; login?: string; lastSubmitAt?: string };

const dir = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'tokseal');
const file = join(dir, 'config.json');

export const DEFAULT_SERVER = 'https://tokseal.dev';

export function readConfig(): Config {
  try {
    return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Config) : {};
  } catch {
    return {};
  }
}

export function writeConfig(c: Config) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(c, null, 2) + '\n', { mode: 0o600 });
}

export function configPath() {
  return file;
}
