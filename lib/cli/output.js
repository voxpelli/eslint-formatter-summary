import { writeFile } from 'node:fs/promises';

export const outputFlags = /** @satisfies {Record<string, import('peowly').AnyFlag>} */ ({
  out: {
    type: 'string',
    'short': 'o',
    'default': '-',
    description: 'Output file path, or "-" for stdout',
  },
});

/**
 * @param {string} output
 * @param {import('peowly').TypedFlags<typeof outputFlags>} flags
 * @param {{
 *   stdout?: Pick<NodeJS.WriteStream, 'write'>,
 *   writeToFile?: typeof writeFile,
 * }} [options]
 * @returns {Promise<void>}
 */
export async function writeOutput (output, flags, { stdout = process.stdout, writeToFile = writeFile } = {}) {
  if (flags.out === '-' || flags.out === '') {
    stdout.write(output);
  } else {
    await writeToFile(flags.out, output, 'utf8');
  }
}
