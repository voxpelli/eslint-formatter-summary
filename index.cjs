/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {import('eslint').ESLint.LintResult[]}   results  ESLint results
 * @param   {import('eslint').ESLint.LintResultData} context
 * @returns {Promise<string>}                                 The formatted output
 */
module.exports = async function formatter(results, { rulesMeta }) {
  const { EFS_OUTPUT, EFS_SORT_BY, EFS_SORT_DESC } = process.env;
  const { format } = await import('./lib/format-results.js');

  return format(results, {
    output: EFS_OUTPUT,
    sortByProp: EFS_SORT_BY,
    sortDescending: EFS_SORT_DESC === 'true',
    rulesMeta
  });
};
