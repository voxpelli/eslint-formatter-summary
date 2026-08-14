import { readFile } from 'node:fs/promises';

import { typesafeIsArray } from '@voxpelli/typed-utils';
import { peowly } from 'peowly';

import { canonicalizeSync } from './canonicalize.js';
import { encodeForStderr, InputError } from './errors.js';
import { outputFlags, writeOutput } from './output.js';
import { prepareProjectResult } from './prepare-project-result.js';
import { readStdin } from './read-stdin.js';

/** @import { CliCommand, CliCommandRun } from 'peowly-commands' */

const description = 'Convert one raw ESLint JSON input into a ProjectResult artifact';

// `Parameters<CliCommandRun>` keeps the signature reference without declaring
// the async arrow's return type — an annotation with the `Promise<void> | void`
// union would trip TS1065 (async return must be Promise<T>).
/** @type {(...args: Parameters<CliCommandRun>) => Promise<void>} */
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
      'eslint-version': {
        type: 'string',
        'default': '',
        description: 'ESLint version label stamped into the output (env: EFS_ESLINT_VERSION)',
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
      throw new InputError(`could not read ${encodeForStderr(inputPath)}`, { cause });
    }
  }

  if (!rawInput.trim()) {
    throw new InputError(`empty ${encodeForStderr(inputTypeName)}`);
  }

  /** @type {unknown} */
  let parsedInput;

  try {
    parsedInput = JSON.parse(rawInput);
  } catch (cause) {
    throw new InputError(`invalid JSON in ${encodeForStderr(inputTypeName)}`, { cause });
  }

  if (!typesafeIsArray(parsedInput)) {
    throw new InputError(`expected an array of ESLint file results in ${encodeForStderr(inputTypeName)}`);
  }

  const baseDir = canonicalizeSync(flags.cwd || process.cwd());
  const projectName = flags.project || process.env['EFS_PROJECT_NAME'] || '';
  const eslintVersion = flags['eslint-version'] || process.env['EFS_ESLINT_VERSION'] || '';

  const result = prepareProjectResult(parsedInput, {
    baseDir,
    project: projectName,
    eslintVersion,
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
