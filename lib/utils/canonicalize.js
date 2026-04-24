import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {string} cwd
 * @returns {string}
 */
export function canonicalizeSync (cwd) {
  const abs = path.resolve(cwd);

  try {
    // eslint-disable-next-line n/no-sync -- canonicalize CLI path before relative-path processing
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
}
