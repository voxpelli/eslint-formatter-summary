import fs from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { peowly } from 'peowly';

import prepareProjectResult from './prepare-project-result.js';

/**
 * @param {string} cwd
 * @returns {string}
 */
const canonicalize = (cwd) => {
  const abs = path.resolve(cwd);
  try {
    return fs.realpathSync.native(abs);
  } catch {
    return abs;
  }
};

/**
 * @returns {Promise<string>}
 */
const readStdin = async () => {
  let data = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) data += chunk;
  return data;
};

/** @type {import('peowly-commands').CliCommandRun} */
const run = async (argv, _importMeta, { parentName }) => {
  const cli = peowly({
    args: argv,
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
      out: {
        type: 'string',
        'short': 'o',
        'default': '-',
        description: 'Output file path, or "-" for stdout',
      },
      cwd: {
        type: 'string',
        'default': '',
        description: 'Strip-prefix for relative paths (default: process.cwd())',
      },
    },
  });

  const { flags, input } = cli;
  if (input.length > 1) {
    process.stderr.write('eslint-summary prepare: expected stdin or a single <input-file> positional\n');
    process.exit(2);
  }
  const inputPath = input.length === 1 ? /** @type {string} */ (input[0]) : '';
  const useStdin = !inputPath && !process.stdin.isTTY;
  if (!inputPath && !useStdin) {
    process.stderr.write('eslint-summary prepare: expected stdin or an <input-file> positional\n');
    process.exit(2);
  }

  /** @type {string} */
  let raw;
  if (useStdin) {
    raw = await readStdin();
    if (!raw.trim()) {
      process.stderr.write('eslint-summary prepare: empty stdin\n');
      process.exit(1);
    }
  } else {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
      raw = await readFile(inputPath, 'utf8');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`eslint-summary prepare: could not read ${inputPath}: ${msg}\n`);
      process.exit(1);
    }
  }

  /** @type {unknown} */
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const src = useStdin ? 'stdin' : inputPath;
    process.stderr.write(`eslint-summary prepare: invalid JSON in ${src}: ${msg}\n`);
    process.exit(1);
  }

  const projectName = flags.project || process.env['EFS_PROJECT_NAME'] || '';
  const baseDir = canonicalize(flags.cwd || process.cwd());

  const result = prepareProjectResult(parsed, {
    baseDir,
    project: projectName,
    warn: (msg) => process.stderr.write(`eslint-summary prepare: ${msg}\n`),
  });

  if (result === undefined) {
    // Zero findings — exit 0 with no output, matching the sibling tool's
    // "presence-means-findings" contract for fleet aggregation.
    return;
  }

  const serialized = JSON.stringify(result);
  if (flags.out === '-' || flags.out === '') {
    process.stdout.write(serialized + '\n');
  } else {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-supplied CLI path
    await writeFile(flags.out, serialized + '\n', 'utf8');
  }
};

/** @type {import('peowly-commands').CliCommand} */
const cmdPrepare = {
  description: 'Aggregate one project\'s raw eslint --format json into the intermediate ProjectResult shape',
  run,
};

export default cmdPrepare;
