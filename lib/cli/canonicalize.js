import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} cwd
 * @returns {string}
 */
export function canonicalizeSync (cwd) {
  const abs = path.resolve(cwd);

  try {
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
