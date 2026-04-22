import { appendFile } from 'node:fs/promises';

/**
 * Append markdown content to the path pointed at by `$GITHUB_STEP_SUMMARY`.
 * Failures are soft-logged to stderr so the caller's primary output is not
 * disrupted when the environment is misconfigured.
 *
 * @param {string} filePath  Target path (typically `$GITHUB_STEP_SUMMARY`).
 * @param {string} markdown  Content to append. A trailing newline is added.
 * @param {string} [callerName]  Prefix for the stderr warning. Defaults to "eslint-formatter-summary".
 * @returns {Promise<void>}
 */
export async function writeStepSummary (filePath, markdown, callerName = 'eslint-formatter-summary') {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- caller-controlled path (typically a trusted env var)
    await appendFile(filePath, markdown + '\n', 'utf8');
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${callerName}: failed to append to $GITHUB_STEP_SUMMARY (${filePath}): ${errorMessage}\n`);
  }
}
