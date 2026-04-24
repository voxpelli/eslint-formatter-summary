import path from 'node:path';

import {
  readdir,
  readFile,
  stat,
} from 'node:fs/promises';

import { toCount } from './coerce.js';
import { isValidProjectResult } from './validate-project-result.js';

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

// Hand-rolled comparators — cannot be expressed via `utils/array.js::sortBy`,
// whose single-key + direction-flag API does not compose error-then-warning-
// then-project tie-breaking. If that helper grows multi-key support, this
// block collapses into `sortBy(['errorCount', 'warningCount', 'project'], …)`.

/** @type {Record<SortMode, (a: ProjectResult, b: ProjectResult) => number>} */
const SORT_MODES = {
  project: byProject,
  severity: bySeverity,
};

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

/**
 * @param {string} dir
 * @param {SortMode} sortMode
 * @returns {Promise<ProjectResult[]>}
 * @throws {NodeJS.ErrnoException} When `dir` is missing or not a directory.
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

    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
    const info = await stat(file).catch(() => {});

    if (!info?.isFile()) continue;

    candidates++;

    if (info.size > MAX_ARTIFACT_BYTES) continue;

    /** @type {unknown} */
    let parsed;

    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      parsed = JSON.parse(await readFile(file, 'utf8'));
    } catch {}

    if (isValidProjectResult(parsed)) {
      results.push(parsed);
    }
  }

  // 100% skip rate on a non-empty candidate set almost always signals a CI
  // misconfiguration (wrong artifact layout, truncated JSON, oversize blobs)
  // — warn on stderr so it does not masquerade as the "all N pass" banner.
  if (candidates > 0 && results.length === 0) {
    process.stderr.write(
      `eslint-summary aggregate: all ${candidates} candidate artifact(s) in ${dir} were skipped (unreadable, oversize, or invalid)\n`
    );
  }

  return results.toSorted(SORT_MODES[sortMode]);
}
