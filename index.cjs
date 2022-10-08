/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {import('eslint').ESLint.LintResult[]}   results  ESLint results
 * @param   {import('eslint').ESLint.LintResultData} context
 * @returns {Promise<string>}                                 The formatted output
 */
module.exports = async function formatter (results, { cwd, rulesMeta }) {
  // eslint-disable-next-line n/no-process-env
  const { EFS_OUTPUT, EFS_SORT_BY, EFS_SORT_REVERSE } = process.env;
  const { format } = await import('./lib/format-results.js');

  return format(results, {
    cwd,
    output: EFS_OUTPUT,
    sortByProp: EFS_SORT_BY,
    sortReverse: EFS_SORT_REVERSE === 'true',
    rulesMeta
  });
};
