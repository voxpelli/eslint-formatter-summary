import { readFile } from 'node:fs/promises';

import { peowly } from 'peowly';

import canonicalizeSync from '../utils/canonicalize.js';
import readStdin from '../utils/read-stdin.js';
import { InputError } from './errors.js';
import { outputFlags, writeOutput } from './output.js';
import prepareProjectResult from './prepare-project-result.js';

/** @import { CliCommand } from 'peowly-commands' */

const description = 'Aggregate one project\'s raw eslint --format json into the intermediate ProjectResult shape';

/** @type {import('peowly-commands').CliCommandRun} */
const run = async (argv, _importMeta, { parentName }) => {
  const cli = peowly({
    args: argv,
    description,
    name: `${parentName} prepare`,
    usage: '[input-file]',
    examples: [
      'project/eslint-results.json',
      'eslint --format json | eslint-summary prepare --project voxpelli/ref-calc',
      '--out results/owner-repo/eslint-result.json project/eslint-results.json',
    ],
    options: {
      project: {
        type: 'string',
        'short': 'p',
        'default': '',
        description: 'owner/repo slug stamped into the output (env: EFS_PROJECT_NAME)',
      },
      cwd: {
        type: 'string',
        'default': '',
        description: 'Strip-prefix for relative paths (default: process.cwd())',
      },
      ...outputFlags,
    },
  });

  const {
    flags,
    input: [inputPath = '', ...remainingInput],
  } = cli;

  if (remainingInput.length) {
    throw new InputError('expected stdin or a single <input-file> positional');
  }

  const useStdin = !inputPath && !process.stdin.isTTY;
  const inputTypeName = useStdin ? 'stdin' : inputPath;

  if (!inputPath && !useStdin) {
    throw new InputError('expected stdin or an <input-file> positional');
  }

  /** @type {string} */
  let rawInput;

  if (useStdin) {
    rawInput = await readStdin();
  } else {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      rawInput = await readFile(inputPath, 'utf8');
    } catch (cause) {
      throw new InputError(`could not read ${inputPath}`, { cause });
    }
  }

  if (!rawInput.trim()) {
    throw new InputError(`empty ${inputTypeName}`);
  }

  /** @type {unknown} */
  let parsedInput;

  try {
    parsedInput = JSON.parse(rawInput);
  } catch (cause) {
    throw new InputError(`invalid JSON in ${inputTypeName}`, { cause });
  }

  const baseDir = canonicalizeSync(flags.cwd || process.cwd());
  const projectName = flags.project || process.env['EFS_PROJECT_NAME'] || '';

  const result = prepareProjectResult(parsedInput, {
    baseDir,
    project: projectName,
  });

  if (result === undefined) {
    // Zero findings — exit 0 with no output, matching the sibling tool's
    // "presence-means-findings" contract for fleet aggregation.
    return;
  }

  await writeOutput(JSON.stringify(result) + '\n', flags);
};

/** @type {CliCommand} */
export const cmdPrepare = {
  description,
  run,
};
