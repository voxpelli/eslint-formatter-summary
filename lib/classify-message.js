/**
 * @typedef {"(parser error)" | "(unused disable)" | "(missing rule)" | "(invalid rule id)" | "(no rule id)"} SyntheticKey
 * @typedef {{ kind: 'rule', id: string } | { kind: 'synthetic', id: SyntheticKey, detail?: string }} ClassifiedMessage
 */

const UNUSED_DISABLE = /\(no problems were reported from '([^']{1,200})'\)/;
const MISSING_RULE = /^Definition for rule '([^']{1,200})' was not found/;
const RULE_ID_SHAPE = /^[@\w/-]+$/;

/**
 * Classify an ESLint LintMessage into a rule violation or a synthetic bucket.
 *
 * Synthetic buckets absorb non-rule messages that would otherwise collapse
 * into a misleading single bucket or render as fake rule rows.
 *
 * Branches evaluated in order; first match wins:
 *   1. fatal === true → (parser error)
 *   2. Null ruleId + unused-disable message regex → (unused disable) + detail
 *   3. String ruleId + missing-rule message regex → (missing rule) + detail
 *   4. String ruleId passing shape guard → { kind: 'rule', id }
 *   5. String ruleId failing shape guard → (invalid rule id)
 *   6. Otherwise → (no rule id) — load-bearing fallback that absorbs future
 *      ESLint message-text rewordings without silent drop.
 *
 * Parentheses in synthetic keys are structurally illegal in real ESLint rule
 * IDs (which match `@?[\w-]+(/[\w-]+)?`), so collisions are impossible.
 *
 * Known limitation: the detail field rides on file entries via tab separator
 * downstream. Tab in a file path (rare on POSIX, illegal on Windows) may
 * mis-render. Switch separator to \x00 in a follow-up if reported.
 *
 * @param {Pick<import('eslint').Linter.LintMessage, 'fatal' | 'ruleId' | 'message'>} message
 * @returns {ClassifiedMessage}
 */
export default function classifyMessage (message) {
  const { fatal, message: text, ruleId } = message;

  if (fatal === true) {
    return { kind: 'synthetic', id: '(parser error)' };
  }

  if (ruleId === undefined || ruleId === null) {
    const unused = typeof text === 'string' ? UNUSED_DISABLE.exec(text) : undefined;
    if (unused && unused[1] !== undefined) {
      return { kind: 'synthetic', id: '(unused disable)', detail: unused[1] };
    }
    return { kind: 'synthetic', id: '(no rule id)' };
  }

  if (typeof ruleId === 'string') {
    const missing = typeof text === 'string' ? MISSING_RULE.exec(text) : undefined;
    if (missing && missing[1] !== undefined) {
      return { kind: 'synthetic', id: '(missing rule)', detail: missing[1] };
    }
    if (RULE_ID_SHAPE.test(ruleId)) {
      return { kind: 'rule', id: ruleId };
    }
    return { kind: 'synthetic', id: '(invalid rule id)' };
  }

  return { kind: 'synthetic', id: '(no rule id)' };
}
