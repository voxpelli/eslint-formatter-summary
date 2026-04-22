import chalk from 'chalk';
import terminalLink from 'terminal-link';

import aggregate from './aggregator.js';
import escapeHtml from './escape-html.js';
import lengthOfLongest from './length-of-longest.js';
import pad from './pad-num.js';
import sanitize from './sanitize-untrusted.js';
import sortBy from './sort-by-prop.js';
import sum from './sum-up.js';
import { SYNTHETIC_FOOTNOTE_TEXT } from './synthetic-footnote-text.js';
import truncateFormatterMarkdown from './truncate-formatter-markdown.js';

const PATH_MAX = 500;
const DEFAULT_FILE_CAP = 50;

const SAFE_URL = /^https?:\/\//i;

/**
 * @param {string|undefined} url
 * @returns {string|undefined}
 */
const safeUrl = (url) => (typeof url === 'string' && SAFE_URL.test(url)) ? url : undefined;

/** @import { ESLint } from 'eslint' */
/** @import { SyntheticKey } from './classify-message.js' */
/** @import { MessageSummary } from './process-message.js' */

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
 * @see lib/cli/build-file-anchor.js `renderFileSpan` — CLI twin that additionally emits a GitHub `blob/HEAD/<path>#L<line>` anchor.
 * @param {string} entry
 * @returns {string}
 */
const renderFileEntry = (entry) => {
  const tab = entry.indexOf('\t');
  if (tab === -1) return `<li>${escapeHtml(sanitize(entry, { maxLength: PATH_MAX }))}</li>`;
  const path = sanitize(entry.slice(0, tab), { maxLength: PATH_MAX });
  const detail = sanitize(entry.slice(tab + 1));
  return `<li>${escapeHtml(path)} — <code>${escapeHtml(detail)}</code></li>`;
};

/**
 * @param {MessageSummary[]} rules
 * @returns {string}
 */
const constructFootnote = (rules) => {
  /** @type {SyntheticKey[]} */
  const keys = [];
  const seen = new Set();
  for (const rule of rules) {
    if (rule.kind === 'synthetic' && !seen.has(rule.id)) {
      seen.add(rule.id);
      keys.push(rule.id);
    }
  }
  if (keys.length === 0) return '';
  const lines = keys.map((k) => `> - \`${k}\` — ${SYNTHETIC_FOOTNOTE_TEXT[k]}`);
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
 * @param {{ markdown: boolean, rulesMeta: import('eslint').ESLint.LintResultData["rulesMeta"], fileCap?: number | undefined }} options
 * @returns {string}
 */
const constructSummary = (rules, { fileCap, markdown, rulesMeta }) => {
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
      const allFiles = [...relativeFilePaths];
      const shown = fileCap === undefined ? allFiles : allFiles.slice(0, fileCap);
      const overflow = allFiles.length - shown.length;
      const filesList = markdown
        ? `<ul>${shown.map((p) => renderFileEntry(p)).join('')}${overflow > 0 ? `<li><em>… and ${overflow} more</em></li>` : ''}</ul>`
        : '';

      return markdown
        ? `| ${errors} | ${warnings} | ${fixable} | <details><summary>${markdownLink(escapeHtml(sanitize(id)), docsUrl).padEnd(maxRule)}</summary>${filesList}</details> |`
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
 * @property {ESLint.LintResultData["rulesMeta"]|undefined} [rulesMeta]
 * @property {FormatCapOptions|undefined} [cap]  When set on the markdown branch, apply per-rule file cap and total byte cap so the output fits within a sticky-PR-comment budget. Ignored on CSV and CLI branches.
 */

/**
 * @typedef FormatCapOptions
 * @property {number | undefined} [fileCap]  Max file entries per rule; overflow becomes a single `… and N more` `<li>`. Defaults to 50.
 * @property {number | undefined} [sizeCap]  Total byte cap; output is truncated at the last complete table row and a trailer line is appended. Defaults to 60 000.
 */

/**
 * Generates formatted summary output from ESLint result set
 *
 * @param   {ESLint.LintResult[]} results  ESLint results
 * @param   {FormatOptions}                        options  Options from process.env
 * @returns {string}                                        The formatted output
 */
export function format (results, options) {
  const {
    cap,
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

  const fileCap = markdown && cap
    ? (cap.fileCap ?? DEFAULT_FILE_CAP)
    : undefined;

  const header = constructHeader(rules, { markdown });
  const summary = constructSummary(rules, { markdown, rulesMeta, fileCap });
  const total = constructTotal(rules);
  const footnote = markdown ? constructFootnote(rules) : '';

  const rendered = `${header}${markdown ? '\n' : '\n\n'}${summary}${footnote}` + (markdown ? '' : `\n\n${total}`);

  return markdown && cap
    ? truncateFormatterMarkdown(rendered, rules.length, cap.sizeCap === undefined ? undefined : { sizeCap: cap.sizeCap })
    : rendered;
}
