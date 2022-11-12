import chalk from 'chalk';
import terminalLink from 'terminal-link';

import aggregate from './aggregator.js';
import lengthOfLongest from './length-of-longest.js';
import pad from './pad-num.js';
import sortBy from './sort-by-prop.js';
import sum from './sum-up.js';

/** @typedef {import('./process-message.js').MessageSummary} MessageSummary */
/** @typedef {(rules: MessageSummary[]) => number} CountingHelper */

/** @type {CountingHelper} */
const maxErrorLen = (rules) => lengthOfLongest('errors', rules);
/** @type {CountingHelper} */
const maxWarningLen = (rules) => lengthOfLongest('warnings', rules);
/** @type {CountingHelper} */
const maxRuleLen = (rules) => lengthOfLongest('ruleId', rules);

/** @type {CountingHelper} */
const totalErrors = (rules) => sum('errors', rules);
/** @type {CountingHelper} */
const totalWarnings = (rules) => sum('warnings', rules);
/** @type {CountingHelper} */
const totalProblems = (rules) => totalErrors(rules) + totalWarnings(rules);

const HEAD_ERROR = 'Errors';
const HEAD_WARNING = 'Warnings';
const HEAD_RULE = 'Rule';

/**
 * @param {string} text
 * @param {string|undefined} url
 * @returns {string}
 */
const markdownLink = (text, url) => url ? `[${text}](${url})` : text;

/**
 * @param {string} text
 * @param {string|undefined} url
 * @returns {string}
 */
const cliLink = (text, url) => url ? terminalLink(text, url, { fallback: false }) : text;

/**
 * @param {string} text
 * @param {number|undefined} number
 * @returns {string}
 */
const dimIfZero = (text, number) => number ? text : chalk.dim(text);

/**
 * @param {MessageSummary[]} rules
 * @param {{ markdown: boolean }} options
 * @returns {string}
 */
const constructHeader = (rules, { markdown }) => {
  if (markdown) {
    const maxError = Math.max(HEAD_ERROR.length, maxErrorLen(rules));
    const maxWarning = Math.max(HEAD_WARNING.length, maxWarningLen(rules));
    const maxRule = Math.max(HEAD_RULE.length, maxRuleLen(rules));

    return (
      `| ${HEAD_ERROR.padEnd(maxError)} | ${HEAD_WARNING.padEnd(
        maxWarning
      )} | ${HEAD_RULE.padEnd(maxRule)} |\n` +
      `| ${'-'.repeat(maxError)} | ${'-'.repeat(maxWarning)} | ${'-'.repeat(
        maxRule
      )} |`
    );
  }
  const errors = '0'.repeat(maxErrorLen(rules));
  const warnings = '0'.repeat(maxWarningLen(rules));
  const longestRule = '0'.repeat(maxRuleLen(rules));
  const len = `${errors} errors | ${warnings} warnings | rule: ${longestRule}`
    .length;
  const header = ' Summary of failing ESLint rules '.padEnd(len);
  return chalk.bgRed(header);
};

/**
 * @param {MessageSummary[]} rules
 * @param {{ markdown: boolean, rulesMeta: import('eslint').ESLint.LintResultData["rulesMeta"] }} options
 * @returns {string}
 */
const constructSummary = (rules, { markdown, rulesMeta }) => {
  const maxError = Math.max(
    markdown ? HEAD_ERROR.length : 0,
    maxErrorLen(rules)
  );
  const maxWarning = Math.max(
    markdown ? HEAD_WARNING.length : 0,
    maxWarningLen(rules)
  );
  const maxRule = Math.max(markdown ? HEAD_RULE.length : 0, maxRuleLen(rules));

  return rules
    .map((rule, i) => {
      const errors = pad(rule.errors, maxError);
      const warnings = pad(rule.warnings, maxWarning);
      const { relativeFilePaths, ruleId } = rule;
      const meta = rulesMeta[ruleId] || {};
      const docsUrl = (meta.docs || {}).url;
      const filesList = markdown
        ? `<ul><li>${[...relativeFilePaths].join('</li><li>')}</li></ul>`
        : '';

      const line = markdown
        ? `| ${errors} | ${warnings} | <details><summary>${markdownLink(ruleId, docsUrl).padEnd(maxRule)}</summary>${filesList}</details> |`
        : `${
            dimIfZero(chalk.red(errors) + ' errors', rule.errors)
          } | ${
            dimIfZero(chalk.yellow(warnings) + ' warnings', rule.warnings)
          } | rule: ${
            chalk.bold(cliLink(ruleId, docsUrl))
          }`;
      return i < rules.length - 1 ? `${line}\n` : line;
    })
    .join('');
};

/**
 * @param {MessageSummary[]} rules
 * @returns {string}
 */
const constructTotal = (rules) =>
  `${
    chalk.red(totalProblems(rules) + ' problems in total')
  } (${
    totalErrors(rules) + chalk.red(' errors')
  }, ${
    totalWarnings(rules) + chalk.yellow(' warnings')
  })`;

/**
 * @typedef FormatOptions
 * @property {string} cwd
 * @property {string|undefined} output
 * @property {string|undefined} sortByProp
 * @property {boolean|undefined} [sortReverse]
 * @property {import('eslint').ESLint.LintResultData["rulesMeta"]|undefined} [rulesMeta]
 */

/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {import('eslint').ESLint.LintResult[]} results  ESLint results
 * @param   {FormatOptions}                        options  Options from process.env
 * @returns {string}                                        The formatted output
 */
export function format (results, options) {
  const {
    cwd,
    output,
    rulesMeta = {},
    sortByProp = 'errors',
    sortReverse = false,
  } = options;

  const rules = aggregate(results, { cwd });

  const prop = sortByProp === 'rule'
    ? ['ruleId']
    : (
        sortByProp === 'warnings'
          ? ['warnings', 'errors', 'ruleId']
          : ['errors', 'warnings', 'ruleId']
      );

  sortBy(prop, rules, sortReverse);

  const markdown = output === 'markdown';

  const header = constructHeader(rules, { markdown });
  const summary = constructSummary(rules, { markdown, rulesMeta });
  const total = constructTotal(rules);

  return `${header}${markdown ? '\n' : '\n\n'}${summary}` + (markdown ? '' : `\n\n${total}`);
}
