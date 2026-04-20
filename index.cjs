/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {import('eslint').ESLint.LintResult[]}   results  ESLint results
 * @param   {import('eslint').ESLint.LintResultData} context
 * @returns {Promise<string>}                                 The formatted output
 */
module.exports = async function formatter (results, { cwd, rulesMeta }) {
  // eslint-disable-next-line n/no-process-env
  const { EFS_GITHUB_STEP_SUMMARY, EFS_OUTPUT, EFS_SORT_BY, EFS_SORT_REVERSE, GITHUB_STEP_SUMMARY } = process.env;
  const { format } = await import('./lib/format-results.js');

  const options = {
    cwd,
    sortByProp: EFS_SORT_BY,
    sortReverse: EFS_SORT_REVERSE === 'true',
    rulesMeta,
  };

  const output = format(results, { ...options, output: EFS_OUTPUT });

  const summaryOptedOut = EFS_GITHUB_STEP_SUMMARY === 'false' || EFS_GITHUB_STEP_SUMMARY === '0';
  const hasFindings = results.some(result => result.errorCount > 0 || result.warningCount > 0);

  if (GITHUB_STEP_SUMMARY && !summaryOptedOut && hasFindings) {
    const markdown = EFS_OUTPUT === 'markdown'
      ? output
      : format(results, { ...options, output: 'markdown' });
    const { appendFile } = await import('node:fs/promises');
    try {
      await appendFile(GITHUB_STEP_SUMMARY, markdown + '\n', 'utf8');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      process.stderr.write(`eslint-formatter-summary: failed to append to $GITHUB_STEP_SUMMARY (${GITHUB_STEP_SUMMARY}): ${errorMessage}\n`);
    }
  }

  return output;
};
