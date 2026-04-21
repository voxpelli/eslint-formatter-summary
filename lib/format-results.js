import chalk from 'chalk';
import terminalLink from 'terminal-link';

import aggregate from './aggregator.js';
import escapeHtml from './escape-html.js';
import lengthOfLongest from './length-of-longest.js';
import pad from './pad-num.js';
import sortBy from './sort-by-prop.js';
import sum from './sum-up.js';

const SAFE_URL = /^https?:\/\//i;

/**
 * @param {string|undefined} url
 * @returns {string|undefined}
 */
const safeUrl = (url) => (typeof url === 'string' && SAFE_URL.test(url)) ? url : undefined;

/** @typedef {import('./process-message.js').MessageSummary} MessageSummary */
/** @typedef {(rules: MessageSummary[]) => number} CountingHelper */

/** @type {CountingHelper} */
const maxErrorLen = (rules) => lengthOfLongest('errors', rules);
/** @type {CountingHelper} */
const maxWarningLen = (rules) => lengthOfLongest('warnings', rules);
/** @type {CountingHelper} */
const maxFixableLen = (rules) => lengthOfLongest('fixable', rules);
/** @type {CountingHelper} */
const maxRuleLen = (rules) => lengthOfLongest('id', rules);

/** @type {CountingHelper} */
const totalErrors = (rules) => sum('errors', rules);
/** @type {CountingHelper} */
const totalWarnings = (rules) => sum('warnings', rules);
/** @type {CountingHelper} */
const totalFixable = (rules) => sum('fixable', rules);
/** @type {CountingHelper} */
const totalProblems = (rules) => totalErrors(rules) + totalWarnings(rules);

const HEAD_ERROR = 'Errors';
const HEAD_WARNING = 'Warnings';
const HEAD_FIXABLE = 'Fixable';
const HEAD_RULE = 'Rule';

/**
 * @param {string} text
 * @param {string|undefined} url
 * @returns {string}
 */
const markdownLink = (text, url) => {
  const safe = safeUrl(url);
  if (!safe) return text;
  // The link target is inlined into an HTML `<summary>` tag downstream, where
  // a `"` or `>` in the URL could escape the generated <a href="…"> attribute.
  // Escape the attribute-breaking chars defensively even though the scheme
  // allowlist already rejects the most dangerous protocols.
  const safeForAttr = safe.replaceAll('"', '%22').replaceAll('<', '%3C').replaceAll('>', '%3E');
  return `[${text}](${safeForAttr})`;
};

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
 * Render a single file entry inside a markdown rule row. Entries are stored as
 * `<path>\t<detail>` when the classifier attached a detail (missing-rule /
 * unused-disable rule name); else just `<path>`.
 *
 * @param {string} entry
 * @returns {string}
 */
const renderFileEntry = (entry) => {
  const tab = entry.indexOf('\t');
  if (tab === -1) return `<li>${escapeHtml(entry)}</li>`;
  const path = entry.slice(0, tab);
  const detail = entry.slice(tab + 1);
  return `<li>${escapeHtml(path)} — <code>${escapeHtml(detail)}</code></li>`;
};

/** @type {Record<import('./classify-message.js').SyntheticKey, string>} */
const SYNTHETIC_FOOTNOTE = {
  '(parser error)': 'file could not be parsed; usually a syntax error or misconfigured parser.',
  '(unused disable)': '`eslint-disable` directive covers no reported problems; the suppressed rule name is shown per file.',
  '(missing rule)': 'ESLint could not find a rule definition; usually a missing or misnamed plugin. The unresolved rule name is shown per file.',
  '(invalid rule id)': 'rule ID failed shape validation (`/^[@\\w/-]+$/`); the source plugin is emitting malformed IDs.',
  '(no rule id)': 'non-rule message not matching any other classifier; catch-all that absorbs future ESLint message rewordings.',
};

/**
 * @param {MessageSummary[]} rules
 * @returns {string}
 */
const constructFootnote = (rules) => {
  /** @type {import('./classify-message.js').SyntheticKey[]} */
  const keys = [];
  const seen = new Set();
  for (const rule of rules) {
    if (rule.kind === 'synthetic' && !seen.has(rule.id)) {
      seen.add(rule.id);
      keys.push(rule.id);
    }
  }
  if (keys.length === 0) return '';
  const lines = keys.map((k) => `> - \`${k}\` — ${SYNTHETIC_FOOTNOTE[k]}`);
  return '\n\n> **Note:**\n' + lines.join('\n');
};

/**
 * @param {MessageSummary[]} rules
 * @param {{ markdown: boolean }} options
 * @returns {string}
 */
const constructHeader = (rules, { markdown }) => {
  if (markdown) {
    const maxError = Math.max(HEAD_ERROR.length, maxErrorLen(rules));
    const maxWarning = Math.max(HEAD_WARNING.length, maxWarningLen(rules));
    const maxFixable = Math.max(HEAD_FIXABLE.length, maxFixableLen(rules));
    const maxRule = Math.max(HEAD_RULE.length, maxRuleLen(rules));

    return (
      `| ${HEAD_ERROR.padEnd(maxError)} | ${HEAD_WARNING.padEnd(maxWarning)} | ${HEAD_FIXABLE.padEnd(maxFixable)} | ${HEAD_RULE.padEnd(maxRule)} |\n` +
      `| ${'-'.repeat(maxError)} | ${'-'.repeat(maxWarning)} | ${'-'.repeat(maxFixable)} | ${'-'.repeat(maxRule)} |`
    );
  }
  const errors = '0'.repeat(maxErrorLen(rules));
  const warnings = '0'.repeat(maxWarningLen(rules));
  const fixable = '0'.repeat(maxFixableLen(rules));
  const longestRule = '0'.repeat(maxRuleLen(rules));
  const len = `${errors} errors | ${warnings} warnings | ${fixable} fixable | rule: ${longestRule}`
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
  const maxFixable = Math.max(
    markdown ? HEAD_FIXABLE.length : 0,
    maxFixableLen(rules)
  );
  const maxRule = Math.max(markdown ? HEAD_RULE.length : 0, maxRuleLen(rules));

  const cell = markdown
    ? (/** @type {number} */ n, /** @type {number} */ len) => n === 0 ? '-'.padStart(len) : pad(n, len)
    : pad;

  return rules
    .map((rule) => {
      const errors = cell(rule.errors, maxError);
      const warnings = cell(rule.warnings, maxWarning);
      const fixable = cell(rule.fixable, maxFixable);
      const { id, kind, relativeFilePaths } = rule;
      const docsUrl = kind === 'rule' ? rulesMeta[id]?.docs?.url : undefined;
      const filesList = markdown
        ? `<ul>${[...relativeFilePaths].map((p) => renderFileEntry(p)).join('')}</ul>`
        : '';

      return markdown
        ? `| ${errors} | ${warnings} | ${fixable} | <details><summary>${markdownLink(escapeHtml(id), docsUrl).padEnd(maxRule)}</summary>${filesList}</details> |`
        : `${
            dimIfZero(chalk.red(errors) + ' errors', rule.errors)
          } | ${
            dimIfZero(chalk.yellow(warnings) + ' warnings', rule.warnings)
          } | ${
            dimIfZero(chalk.green(fixable) + ' fixable', rule.fixable)
          } | rule: ${
            chalk.bold(cliLink(id, docsUrl))
          }`;
    })
    .join('\n');
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
  }, ${
    totalFixable(rules) + chalk.green(' fixable')
  })`;

/**
 * @param {string} value
 * @returns {string}
 */
const csvField = (value) => `"${value.replaceAll('"', '""')}"`;

/**
 * @param {MessageSummary[]} rules
 * @returns {string}
 */
const constructCsv = (rules) => {
  const rows = rules.map(({ errors, fixable, id, warnings }) =>
    `${errors},${warnings},${fixable},${csvField(id)}`
  );
  return ['errors,warnings,fixable,rule', ...rows].join('\n');
};

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

  const prop = sortByProp === 'rule'
    ? ['id']
    : (
        sortByProp === 'warnings'
          ? ['warnings', 'errors', 'id']
          : ['errors', 'warnings', 'id']
      );

  const rules = sortBy(prop, aggregate(results, { cwd }), sortReverse);

  if (output === 'csv') return constructCsv(rules);

  const markdown = output === 'markdown';

  const header = constructHeader(rules, { markdown });
  const summary = constructSummary(rules, { markdown, rulesMeta });
  const total = constructTotal(rules);
  const footnote = markdown ? constructFootnote(rules) : '';

  return `${header}${markdown ? '\n' : '\n\n'}${summary}${footnote}` + (markdown ? '' : `\n\n${total}`);
}
