import path from 'node:path';
import {
  readdir, readFile, stat, writeFile,
} from 'node:fs/promises';

import { peowly } from 'peowly';

import { parseNumericFlag, toCount } from './coerce.js';
import { InputError, isErrorWithCode } from './errors.js';
import renderComment, { renderAllPass } from './render-comment.js';
import truncateComment from './truncate-comment.js';
import isValidProjectResult from './validate-project-result.js';

/** @import { Stats } from 'node:fs' */
/** @import { CliCommand } from 'peowly-commands' */
/** @import { ProjectResult } from './prepare-project-result.js' */

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

/** @typedef {'project' | 'severity'} SortMode */

// Hand-rolled comparators — cannot be expressed via `lib/sort-by-prop.js`,
// whose numeric-vs-string direction logic is baked in per-prop. If that API
// grows multi-key + explicit direction support (tracked loosely), this block
// collapses into a `sortBy(['errorCount', 'warningCount', 'project'], …)` call.

/**
 * @param {ProjectResult} a
 * @param {ProjectResult} b
 * @returns {number}
 */
const byProject = (a, b) => String(a.project).localeCompare(String(b.project));

/**
 * @param {ProjectResult} a
 * @param {ProjectResult} b
 * @returns {number}
 */
const bySeverity = (a, b) =>
  (toCount(b.errorCount) - toCount(a.errorCount)) ||
  (toCount(b.warningCount) - toCount(a.warningCount)) ||
  byProject(a, b);

/** @type {Record<SortMode, (a: ProjectResult, b: ProjectResult) => number>} */
const SORT_MODES = { project: byProject, severity: bySeverity };

/**
 * @param {string} dir
 * @param {SortMode} sortMode
 * @returns {Promise<ProjectResult[]>}
 * @throws {NodeJS.ErrnoException} When `dir` is missing or not a directory.
 * An *empty* directory is not an error — it maps to the "all N pass" branch;
 * a missing or non-directory path signals a misconfigured CI invocation and
 * the caller is expected to exit non-zero.
 */
const readResultsDirectory = async (dir, sortMode) => {
  /** @type {ProjectResult[]} */
  const results = [];
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
  const subdirs = await readdir(dir);
  let candidates = 0;
  for (const sub of subdirs) {
    const file = path.join(dir, sub, 'eslint-result.json');
    /** @type {Stats} */
    let info;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      info = await stat(file);
    } catch {
      continue;
    }
    if (!info.isFile()) continue;
    candidates++;
    if (info.size > MAX_ARTIFACT_BYTES) continue;
    /** @type {string} */
    let raw;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      raw = await readFile(file, 'utf8');
    } catch {
      continue;
    }
    /** @type {unknown} */
    let parsed;
    try { parsed = JSON.parse(raw); } catch { continue; }
    if (!isValidProjectResult(parsed)) continue;
    results.push(parsed);
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
};

/** @type {import('peowly-commands').CliCommandRun} */
const run = async (argv, _importMeta, { parentName }) => {
  const cli = peowly({
    args: argv,
    name: `${parentName} aggregate`,
    usage: '<results-dir>',
    examples: [
      'results/',
      '--out comment.md results/',
      '--project-count 25 results/',
    ],
    options: {
      'project-count': {
        type: 'string',
        'default': '',
        description: 'Total project count for the "all N pass" message (env: EXTERNAL_PROJECT_COUNT)',
      },
      out: {
        type: 'string',
        'short': 'o',
        'default': '-',
        description: 'Output file path, or "-" for stdout',
      },
      'size-cap': {
        type: 'string',
        'default': '',
        description: 'Byte cap for sticky-PR-comment truncation (default 60000)',
      },
      'file-cap': {
        type: 'string',
        'default': '',
        description: 'Max file entries per rule before overflow trailer (default 50)',
      },
      'sort-by': {
        type: 'string',
        'default': 'project',
        description: 'Order of project blocks: "project" (alphabetical) or "severity" (errors desc)',
      },
      full: {
        type: 'boolean',
        'default': false,
        description: 'Emit uncapped markdown (redirect to $GITHUB_STEP_SUMMARY explicitly)',
      },
    },
  });

  const { flags, input } = cli;
  if (input.length !== 1) {
    throw new InputError('expected exactly one <results-dir> positional');
  }
  const dir = /** @type {string} */ (input[0]);

  const { env } = process;

  const projectCount = parseNumericFlag(flags['project-count'] || env['EXTERNAL_PROJECT_COUNT'] || '', '--project-count');
  const sizeCap = parseNumericFlag(flags['size-cap'] || env['EFS_SIZE_CAP'] || '', '--size-cap');
  const fileCap = parseNumericFlag(flags['file-cap'] || '', '--file-cap');
  const sortByRaw = flags['sort-by'] || 'project';
  if (sortByRaw !== 'project' && sortByRaw !== 'severity') {
    throw new InputError(`--sort-by must be "project" or "severity" (got "${sortByRaw}")`);
  }
  const sortBy = /** @type {SortMode} */ (sortByRaw);

  /** @type {ProjectResult[]} */
  let results;
  try {
    results = await readResultsDirectory(dir, sortBy);
  } catch (err) {
    if (isErrorWithCode(err) && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) {
      throw new InputError(`results directory not found: ${dir}`, { cause: err });
    }
    throw err;
  }

  /** @type {string} */
  let output;
  if (results.length === 0) {
    output = renderAllPass(projectCount);
  } else {
    const full = renderComment(results, fileCap === undefined ? undefined : { fileCap });
    output = flags.full
      ? full
      : truncateComment(full, results, sizeCap === undefined ? undefined : { sizeCap });
  }

  if (flags.out === '-' || flags.out === '') {
    process.stdout.write(output);
  } else {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
    await writeFile(flags.out, output, 'utf8');
  }
};

/** @type {CliCommand} */
const cmdAggregate = {
  description: 'Aggregate a directory of ProjectResult files into a sticky-PR-comment markdown',
  run,
};

export default cmdAggregate;
