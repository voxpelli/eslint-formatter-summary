/**
 * Parse a truthy-ish env-var value.
 *
 * @param {string | undefined} raw
 * @returns {boolean}
 */
const envTruthy = (raw) => raw === 'true' || raw === '1' || raw === 'yes';

/**
 * Parse a positive-integer env-var value. Invalid values fall back to the
 * default and log a single warning to stderr — we never want a bad env var
 * to crash an ESLint run.
 *
 * @param {string | undefined} raw
 * @param {string} name
 * @returns {number | undefined}
 */
const envPositiveInt = (raw, name) => {
  if (raw === undefined || raw === '') return;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    process.stderr.write(`eslint-formatter-summary: ${name} must be a positive integer (got "${raw}"); using default\n`);
    return;
  }
  return n;
};

/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {import('eslint').ESLint.LintResult[]}   results  ESLint results
 * @param   {import('eslint').ESLint.LintResultData} context
 * @returns {Promise<string>}                                 The formatted output
 */
module.exports = async function formatter (results, { cwd, rulesMeta }) {
  const {
    EFS_CAP,
    EFS_FILE_CAP,
    EFS_OUTPUT,
    EFS_SIZE_CAP,
    EFS_SKIP_GH_SUMMARY,
    EFS_SORT_BY,
    EFS_SORT_REVERSE,
    GITHUB_STEP_SUMMARY,
    // eslint-disable-next-line n/no-process-env -- formatter reads its config exclusively from env vars; this is the only access point
  } = process.env;
  const { format } = await import('./lib/format-results.js');

  const options = {
    cwd,
    sortByProp: EFS_SORT_BY,
    sortReverse: EFS_SORT_REVERSE === 'true',
    rulesMeta,
  };

  // Caps are purely opt-in via EFS_CAP — the formatter default is
  // uncapped output so non-CI consumers (terminal, file, piped tools) see
  // every file and every rule. Caps only apply to the markdown branch; CSV
  // and the chalk-coloured CLI branch ignore them.
  const cap = envTruthy(EFS_CAP)
    ? {
        fileCap: envPositiveInt(EFS_FILE_CAP, 'EFS_FILE_CAP'),
        sizeCap: envPositiveInt(EFS_SIZE_CAP, 'EFS_SIZE_CAP'),
      }
    : undefined;

  const output = format(results, { ...options, output: EFS_OUTPUT, cap });

  const skipSummary = envTruthy(EFS_SKIP_GH_SUMMARY);
  const hasFindings = results.some(result => result.errorCount > 0 || result.warningCount > 0);

  if (GITHUB_STEP_SUMMARY && !skipSummary && hasFindings) {
    // Step summary has ~1 MB headroom (vs ~65 KB for sticky comments), so we
    // always write the *uncapped* markdown here even when `cap` truncated the
    // returned `output`. Consumers can follow the step-summary link for the
    // full report.
    const markdown = EFS_OUTPUT === 'markdown' && !cap
      ? output
      : format(results, { ...options, output: 'markdown' });
    const { 'default': writeStepSummary } = await import('./lib/write-step-summary.js');
    await writeStepSummary(GITHUB_STEP_SUMMARY, markdown);
  }

  return output;
};
