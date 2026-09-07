/** Shared helpers for streaming local log files. Pure local file reading. */
import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

export async function walkFiles(dir: string, ext: string, maxDepth = 8): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory() && maxDepth > 0) out.push(...(await walkFiles(p, ext, maxDepth - 1)));
    else if (e.isFile() && e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

/** Yield parsed JSON objects, one per line; malformed lines are skipped. */
export async function* jsonLines(file: string): AsyncGenerator<Record<string, any>> {
  const rl = createInterface({ input: createReadStream(file, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line[0] !== '{') continue;
    try {
      yield JSON.parse(line);
    } catch {
      /* skip */
    }
  }
}

export const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
