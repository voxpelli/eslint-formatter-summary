import path from 'node:path';
import {
  readdir, readFile, stat, writeFile,
} from 'node:fs/promises';

import { peowly } from 'peowly';

import writeStepSummary from '../write-step-summary.js';
import renderComment, { renderAllPass } from './render-comment.js';
import truncateComment from './truncate-comment.js';

/** @typedef {import('./prepare-project-result.js').ProjectResult} ProjectResult */

const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

/**
 * @param {string} dir
 * @returns {Promise<ProjectResult[]>}
 */
const readResultsDirectory = async (dir) => {
  /** @type {ProjectResult[]} */
  const results = [];
  let subdirs;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
    subdirs = await readdir(dir);
  } catch {
    return results;
  }
  for (const sub of subdirs) {
    const file = path.join(dir, sub, 'eslint-result.json');
    /** @type {import('node:fs').Stats} */
    let info;
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      info = await stat(file);
    } catch {
      continue;
    }
    if (!info.isFile() || info.size > MAX_ARTIFACT_BYTES) continue;
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    const p = /** @type {Record<string, unknown>} */ (parsed);
    if (p['rules'] && (typeof p['rules'] !== 'object' || Array.isArray(p['rules']))) continue;
    results.push(/** @type {ProjectResult} */ (p));
  }
  return results.toSorted((a, b) => String(a.project).localeCompare(String(b.project)));
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
        description: 'Byte cap for sticky-PR-comment truncation (env: EFS_SIZE_CAP, default 60000)',
      },
      'file-cap': {
        type: 'string',
        'default': '',
        description: 'Max file entries per rule before overflow trailer (default 50)',
      },
    },
  });

  const { flags, input } = cli;
  if (input.length !== 1) {
    process.stderr.write('eslint-summary aggregate: expected exactly one <results-dir> positional\n');
    process.exit(2);
  }
  const dir = /** @type {string} */ (input[0]);

  const { env } = process;
  const projectCountRaw = flags['project-count'] || env['EXTERNAL_PROJECT_COUNT'] || '';
  const projectCount = projectCountRaw ? Number(projectCountRaw) : undefined;
  const sizeCapRaw = flags['size-cap'] || env['EFS_SIZE_CAP'] || '';
  const sizeCap = sizeCapRaw ? Number(sizeCapRaw) : undefined;
  const fileCapRaw = flags['file-cap'] || '';
  const fileCap = fileCapRaw ? Number(fileCapRaw) : undefined;

  const results = await readResultsDirectory(dir);

  /** @type {string} */
  let output;
  if (results.length === 0) {
    output = renderAllPass(projectCount);
  } else {
    const full = renderComment(results, fileCap === undefined ? undefined : { fileCap });
    const stepSummary = env['GITHUB_STEP_SUMMARY'];
    if (stepSummary) {
      await writeStepSummary(stepSummary, full, 'eslint-summary aggregate');
    }
    output = truncateComment(full, results, sizeCap === undefined ? undefined : { sizeCap });
  }

  if (flags.out === '-' || flags.out === '') {
    process.stdout.write(output);
  } else {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
    await writeFile(flags.out, output, 'utf8');
  }
};

/** @type {import('peowly-commands').CliCommand} */
const cmdAggregate = {
  description: 'Aggregate a directory of ProjectResult files into a sticky-PR-comment markdown',
  run,
};

export default cmdAggregate;
