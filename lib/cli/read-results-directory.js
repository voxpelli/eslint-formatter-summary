import path from 'node:path';

import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';

import { toCount } from './coerce.js';
import { AllSkippedError, encodeForStderr, isErrorWithCode } from './errors.js';
import { isValidProjectResult } from './validate-project-result.js';

/** @import { Stats } from 'node:fs' */
/** @import { ProjectResult } from './prepare-project-result.js' */

/** @typedef {'project' | 'severity'} SortMode */

/**
 * @param {ProjectResult} a
 * @param {ProjectResult} b
 * @returns {number}
 */
const byProject = (a, b) =>
  String(a.project).localeCompare(String(b.project));

/**
 * @param {ProjectResult} a
 * @param {ProjectResult} b
 * @returns {number}
 */
const bySeverity = (a, b) =>
  (toCount(b.errorCount) - toCount(a.errorCount)) ||
  (toCount(b.warningCount) - toCount(a.warningCount)) ||
  byProject(a, b);

// Hand-rolled comparators — utils/array.js::sortBy supports multi-key
// sorting, but byProject uses localeCompare (locale-aware) while sortBy
// uses code-unit `<` comparison. If that helper grows a locale-aware mode,
// this block collapses into sortBy(['errorCount', 'warningCount', 'project'], …).

/** @type {Record<SortMode, (a: ProjectResult, b: ProjectResult) => number>} */
const SORT_MODES = {
  project: byProject,
  severity: bySeverity,
};

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

/**
 * Warn on stderr about a skipped candidate artifact. Missing
 * `eslint-result.json` files stay silent (presence-means-findings
 * convention) — only candidates that exist but cannot be consumed are
 * surfaced, so a partially-malformed fleet is debuggable instead of
 * silently masquerading as a clean run.
 *
 * @param {string} file
 * @param {string} reason
 */
const warnSkipped = (file, reason) => {
  process.stderr.write(`eslint-summary aggregate: skipped ${encodeForStderr(file)} (${reason})\n`);
};

/**
 * @param {string} dir
 * @param {SortMode} sortMode
 * @returns {Promise<ProjectResult[]>}
 * @throws {NodeJS.ErrnoException} When `dir` is missing or not a directory.
 * @throws {AllSkippedError} When a non-empty candidate set yields zero valid
 * results (100% skip rate — a misconfigured CI invocation, not a clean run).
 * An *empty* directory is not an error — it maps to the "all N pass" branch;
 * a missing or non-directory path signals a misconfigured CI invocation and
 * the caller is expected to exit non-zero.
 */
export async function readResultsDirectory (dir, sortMode) {
  /** @type {ProjectResult[]} */
  const results = [];
  let candidates = 0;

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
  const subdirs = await readdir(dir);

  for (const sub of subdirs) {
    const file = path.join(dir, sub, 'eslint-result.json');

    /** @type {Stats | undefined} */
    let info;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      info = await stat(file);
    } catch (err) {
      // Only a missing file is "no candidate" (presence-means-findings).
      // EACCES / ELOOP / ENAMETOOLONG mean a real candidate that cannot be
      // read — surface it and count it so a 100% failure still trips
      // AllSkippedError instead of masquerading as a clean run.
      const code = isErrorWithCode(err) ? err.code : undefined;
      if (code === 'ENOENT' || code === 'ENOTDIR') continue;
      candidates++;
      warnSkipped(file, `unreadable (${code ?? 'stat error'})`);
      continue;
    }

    if (!info?.isFile()) {
      candidates++;
      warnSkipped(file, 'not a regular file');
      continue;
    }

    candidates++;

    if (info.size > MAX_ARTIFACT_BYTES) {
      warnSkipped(file, 'oversize >5 MB');
      continue;
    }

    /** @type {unknown} */
    let parsed;

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      parsed = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      warnSkipped(file, 'unreadable or unparseable JSON');
      continue;
    }

    if (isValidProjectResult(parsed)) {
      results.push(parsed);
    } else {
      warnSkipped(file, 'invalid result shape');
    }
  }

  // 100% skip rate on a non-empty candidate set almost always signals a CI
  // misconfiguration (wrong artifact layout, truncated JSON, oversize blobs)
  // — fail loudly instead of masquerading as the "all N pass" banner.
  if (candidates > 0 && results.length === 0) {
    throw new AllSkippedError(
      `all ${candidates} candidate artifact(s) in ${encodeForStderr(dir)} were skipped (unreadable, oversize, or invalid)`
    );
  }

  return results.toSorted(SORT_MODES[sortMode]);
}
