const { format } = require('./lib/format-results.js');
const { envPositiveInt, envTruthy } = require('./lib/utils/env.js');
const { writeStepSummary } = require('./lib/write-step-summary.js');

/** @import { ESLint } from 'eslint' */

/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {ESLint.LintResult[]}   results
 * @param   {ESLint.LintResultData} context
 * @returns {Promise<string>}
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

  const options = {
    cwd,
    sortByProp: EFS_SORT_BY,
    sortReverse: envTruthy(EFS_SORT_REVERSE),
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

    await writeStepSummary(GITHUB_STEP_SUMMARY, markdown);
  }

  return output;
};
