import assert from 'node:assert/strict';
import test from 'node:test';

import { prepareProjectResult } from '../lib/cli/prepare-project-result.js';

/** @import { LintResultLite } from '../lib/cli/prepare-project-result.js' */

const baseDir = '/repo';

test('prepareProjectResult returns undefined when input is not an array', () => {
  assert.equal(prepareProjectResult(undefined, { baseDir }), undefined);
  assert.equal(prepareProjectResult({}, { baseDir }), undefined);
  assert.equal(prepareProjectResult('string', { baseDir }), undefined);
});

test('prepareProjectResult returns undefined when zero errors and warnings', () => {
  const raw = [{ filePath: '/repo/a.js', errorCount: 0, warningCount: 0, messages: [] }];
  assert.equal(prepareProjectResult(raw, { baseDir }), undefined);
});

test('prepareProjectResult aggregates one rule across files with path:line entries', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([
    {
      filePath: '/repo/src/a.js',
      errorCount: 2,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [
        { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 10, message: 'x' },
        { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 22, message: 'x' },
      ],
    },
    {
      filePath: '/repo/src/b.js',
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [
        { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 5, message: 'x' },
      ],
    },
  ]);
  const result = prepareProjectResult(raw, { baseDir, project: 'acme/app' });
  assert.ok(result);
  assert.equal(result.project, 'acme/app');
  assert.equal(result.errorCount, 3);
  assert.equal(result.warningCount, 0);
  assert.deepEqual(result.syntheticKeys, []);
  assert.deepEqual(result.rules['no-unused-vars']?.files, [
    'src/a.js:10', 'src/a.js:22', 'src/b.js:5',
  ]);
  assert.equal(result.rules['no-unused-vars']?.errors, 3);
});

test('prepareProjectResult buckets parser errors into (parser error) with line entries', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([{
    filePath: '/repo/broken.js',
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    messages: [
      // eslint-disable-next-line unicorn/no-null
      { ruleId: null, severity: 2, fatal: true, column: 1, line: 1, message: 'Parsing error: Unexpected token' },
    ],
  }]);
  const result = prepareProjectResult(raw, { baseDir });
  assert.ok(result);
  assert.deepEqual(result.syntheticKeys, ['(parser error)']);
  assert.deepEqual(result.rules['(parser error)']?.files, ['broken.js:1']);
});

test('prepareProjectResult captures detail via \\t separator for unused-disable', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([{
    filePath: '/repo/a.js',
    errorCount: 0,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    messages: [
      // eslint-disable-next-line unicorn/no-null
      { ruleId: null, severity: 1, column: 1, line: 3, message: "Unused eslint-disable directive (no problems were reported from 'no-console')." },
    ],
  }]);
  const result = prepareProjectResult(raw, { baseDir });
  assert.ok(result);
  assert.deepEqual(result.syntheticKeys, ['(unused disable)']);
  assert.deepEqual(result.rules['(unused disable)']?.files, ['a.js:3\tno-console']);
});

test('prepareProjectResult captures detail for missing-rule classification', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([{
    filePath: '/repo/a.js',
    errorCount: 1,
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    messages: [
      { ruleId: 'foo/missing', severity: 2, column: 1, line: 1, message: "Definition for rule 'foo/missing' was not found." },
    ],
  }]);
  const result = prepareProjectResult(raw, { baseDir });
  assert.ok(result);
  assert.deepEqual(result.syntheticKeys, ['(missing rule)']);
  assert.deepEqual(result.rules['(missing rule)']?.files, ['a.js:1\tfoo/missing']);
  assert.equal(result.rules['foo/missing'], undefined, 'missing-rule should not create a fake rule bucket');
});

test('prepareProjectResult keeps relative ../ paths for files outside cwd', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([
    {
      filePath: '/other/a.js',
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [{ ruleId: 'no-undef', severity: 2, column: 1, line: 1, message: 'x' }],
    },
    {
      filePath: '/other/b.js',
      errorCount: 1,
      warningCount: 0,
      fixableErrorCount: 0,
      fixableWarningCount: 0,
      messages: [{ ruleId: 'no-undef', severity: 2, column: 1, line: 2, message: 'x' }],
    },
  ]);
  const result = prepareProjectResult(raw, { baseDir: '/repo/nested' });
  assert.ok(result);
  assert.equal(result.rules['no-undef']?.files.length, 2);
  // path.relative('/repo/nested', '/other/a.js') → '../../other/a.js'
  assert.ok(result.rules['no-undef']?.files.every(f => f.startsWith('../')), 'entries should use ../ relative form');
});

test('prepareProjectResult counts fixable messages in bucket.fixable', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([{
    filePath: '/repo/a.js',
    errorCount: 0,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 1,
    messages: [
      { ruleId: 'semi', severity: 1, column: 1, line: 1, fix: { range: [0, 0], text: ';' }, message: 'x' },
    ],
  }]);
  const result = prepareProjectResult(raw, { baseDir });
  assert.ok(result);
  assert.equal(result.rules['semi']?.fixable, 1);
  assert.equal(result.fixableWarningCount, 1);
});

test('prepareProjectResult sums file-level counts from ESLint, not message walk', () => {
  const raw = /** @satisfies {LintResultLite[]} */ ([{
    filePath: '/repo/a.js',
    errorCount: 5,  // trust ESLint's count even if messages array disagrees
    warningCount: 0,
    fixableErrorCount: 0,
    fixableWarningCount: 0,
    messages: [
      { ruleId: 'foo', severity: 2, column: 1, line: 1, message: 'x' },  // only 1 message, but count says 5
    ],
  }]);
  const result = prepareProjectResult(raw, { baseDir });
  assert.ok(result);
  assert.equal(result.errorCount, 5);
});
