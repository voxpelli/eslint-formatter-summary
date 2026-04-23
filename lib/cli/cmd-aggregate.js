import { writeFile } from 'node:fs/promises';

import { peowly } from 'peowly';

import { parseNumericFlag } from './coerce.js';
import { InputError, isErrorWithCode } from './errors.js';
import { readResultsDirectory } from './read-results-directory.js';
import renderComment, { renderAllPass } from './render-comment.js';
import truncateComment from './truncate-comment.js';

/** @import { CliCommand } from 'peowly-commands' */
/** @import { ProjectResult } from './prepare-project-result.js' */

const description = 'Aggregate a directory of ProjectResult files into a sticky-PR-comment markdown';

/** @type {import('peowly-commands').CliCommandRun} */
const run = async (argv, _importMeta, { parentName }) => {
  const cli = peowly({
    args: argv,
    name: `${parentName} aggregate`,
    description,
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
  const dir = input[0];

  if (!dir) {
    throw new InputError('expected at least one <results-dir>');
  }

  if (input.length > 1) {
    throw new InputError('no more than one <results-dir>');
  }

  const {
    EFS_SIZE_CAP,
    EXTERNAL_PROJECT_COUNT,
  } = process.env;

  const projectCount = parseNumericFlag(flags['project-count'] || EXTERNAL_PROJECT_COUNT || '', '--project-count');
  const sizeCap = parseNumericFlag(flags['size-cap'] || EFS_SIZE_CAP || '', '--size-cap');
  const fileCap = parseNumericFlag(flags['file-cap'] || '', '--file-cap');
  const sortBy = flags['sort-by'] || 'project';

  if (sortBy !== 'project' && sortBy !== 'severity') {
    throw new InputError(`--sort-by must be "project" or "severity" (got "${sortBy}")`);
  }

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
export const cmdAggregate = {
  description,
  run,
};
