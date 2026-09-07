/** Token + device-code helpers (server only). */
import { createHash, randomBytes } from 'node:crypto';

export const newApiToken = () => 'tsk_' + randomBytes(24).toString('hex');
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
export const newDeviceCode = () => randomBytes(24).toString('hex');

/** Human-typable code like "K7PD-3XQM" (no 0/O/1/I). */
export function newUserCode() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const b = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += A[b[i] % A.length];
  return s.slice(0, 4) + '-' + s.slice(4);
}

export const normalizeUserCode = (s: string) =>
  s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^(.{4})(.{4})$/, '$1-$2');
