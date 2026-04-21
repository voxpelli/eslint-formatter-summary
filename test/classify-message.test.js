import assert from 'node:assert/strict';
import test from 'node:test';

import classifyMessage from '../lib/classify-message.js';

test('branch 1: fatal=true is classified as (parser error)', () => {
  assert.deepEqual(
    classifyMessage({ fatal: true, ruleId: null, message: 'Parsing error: Unexpected token' }),
    { kind: 'synthetic', id: '(parser error)' },
  );
});

test('branch 1: fatal=true wins even when ruleId is a string', () => {
  assert.deepEqual(
    classifyMessage({ fatal: true, ruleId: 'no-unused-vars', message: 'x' }),
    { kind: 'synthetic', id: '(parser error)' },
  );
});

test('branch 2: null ruleId + unused-disable message captures the suppressed rule', () => {
  assert.deepEqual(
    classifyMessage({
      fatal: false,
      ruleId: null,
      message: "Unused eslint-disable directive (no problems were reported from 'no-console').",
    }),
    { kind: 'synthetic', id: '(unused disable)', detail: 'no-console' },
  );
});

test('branch 3: string ruleId + missing-rule message captures the rule name', () => {
  assert.deepEqual(
    classifyMessage({
      fatal: false,
      ruleId: 'no-undef-plugin/missing',
      message: "Definition for rule 'no-undef-plugin/missing' was not found.",
    }),
    { kind: 'synthetic', id: '(missing rule)', detail: 'no-undef-plugin/missing' },
  );
});

test('branch 4: well-formed ruleId is classified as a rule', () => {
  assert.deepEqual(
    classifyMessage({ fatal: false, ruleId: 'no-unused-vars', message: 'x' }),
    { kind: 'rule', id: 'no-unused-vars' },
  );
});

test('branch 4: scoped and slashed ruleIds pass the shape guard', () => {
  for (const id of ['@scope/rule', 'plugin/rule', '@scope/plugin/nested-rule']) {
    assert.deepEqual(
      classifyMessage({ fatal: false, ruleId: id, message: 'x' }),
      { kind: 'rule', id },
    );
  }
});

test('branch 5: malformed ruleId falls into (invalid rule id)', () => {
  assert.deepEqual(
    classifyMessage({ fatal: false, ruleId: 'has space', message: 'x' }),
    { kind: 'synthetic', id: '(invalid rule id)' },
  );
});

test('branch 5: empty-string and whitespace ruleIds are (invalid rule id)', () => {
  for (const bad of ['', '   ', 'weird<script>']) {
    assert.deepEqual(
      classifyMessage({ fatal: false, ruleId: bad, message: 'x' }),
      { kind: 'synthetic', id: '(invalid rule id)' },
    );
  }
});

test('branch 6: null ruleId without recognizable message falls into (no rule id)', () => {
  assert.deepEqual(
    classifyMessage({ fatal: false, ruleId: null, message: 'some unknown non-rule diagnostic' }),
    { kind: 'synthetic', id: '(no rule id)' },
  );
});

test('branch 6 is load-bearing: future ESLint rewording still lands somewhere', () => {
  const result = classifyMessage({
    fatal: false,
    ruleId: null,
    message: 'Completely reworded unused-disable hint that does not match our regex',
  });
  assert.equal(result.kind, 'synthetic');
  assert.equal(result.id, '(no rule id)');
});
