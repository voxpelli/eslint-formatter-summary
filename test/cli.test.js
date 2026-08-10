/* eslint-disable security/detect-non-literal-fs-filename */
/* eslint-disable security/detect-non-literal-regexp */

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  mkdir, readFile, stat, writeFile,
} from 'node:fs/promises';

import { runCli, tmpDir, writeOneProjectArtifact } from './_helpers.js';

/** @import { LintResultLite } from '../lib/cli/prepare-project-result.js' */

const rawFixture = () => /** @satisfies {LintResultLite[]} */ ([
  {
    filePath: '/proj/src/a.js',
    errorCount: 2,
    warningCount: 1,
    fixableErrorCount: 0,
    fixableWarningCount: 1,
    messages: [
      { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 10, message: 'x' },
      { ruleId: 'no-unused-vars', severity: 2, column: 1, line: 22, message: 'x' },
      { ruleId: 'semi', severity: 1, column: 1, line: 3, fix: { range: [0, 0], text: ';' }, message: 'z' },
    ],
  },
]);

test('prepare: reads a raw ESLint JSON file and emits ProjectResult to stdout', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stderr, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj', inputFile]
  );
  assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
  assert.equal(stderr, '');
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'acme/demo');
  assert.equal(parsed.errorCount, 2);
  assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
});

test('prepare: reads project slug from EFS_PROJECT_NAME when flag absent', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--cwd', '/proj', inputFile],
    { env: { EFS_PROJECT_NAME: 'from/env' } }
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'from/env');
});

test('prepare: stamps --eslint-version into the ProjectResult', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--eslint-version', '9.22', '--cwd', '/proj', inputFile]
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.eslintVersion, '9.22');
});

test('prepare: reads eslint version from EFS_ESLINT_VERSION when flag absent', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--cwd', '/proj', inputFile],
    { env: { EFS_ESLINT_VERSION: '10' } }
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.eslintVersion, '10');
});

test('prepare: omits eslintVersion when neither flag nor env is given', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj', inputFile],
    { env: { EFS_ESLINT_VERSION: undefined } }
  );
  assert.equal(code, 0);
  const parsed = JSON.parse(stdout);
  assert.equal('eslintVersion' in parsed, false, 'field must be absent when not supplied');
});

test('prepare: writes to --out file and emits nothing to stdout', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  const outFile = path.join(tmp, 'out.json');
  await writeFile(inputFile, JSON.stringify(rawFixture()), 'utf8');
  const { code, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj', '--out', outFile, inputFile]
  );
  assert.equal(code, 0);
  assert.equal(stdout, '');
  const parsed = JSON.parse(await readFile(outFile, 'utf8'));
  assert.equal(parsed.project, 'acme/demo');
});

test('prepare: exits 0 with no output when the run has zero findings', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'raw.json');
  await writeFile(inputFile, JSON.stringify([{ filePath: '/proj/a.js', errorCount: 0, warningCount: 0, messages: [] }]), 'utf8');
  const { code, stdout } = await runCli(['prepare', inputFile]);
  assert.equal(code, 0);
  assert.equal(stdout, '');
});

test('prepare: exits 1 with "empty stdin" when no positional and stdin is empty', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: '' });
  assert.equal(code, 1);
  assert.match(stderr, /empty stdin/);
});

test('prepare: exits 1 via InputError when stdin JSON is not an array', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: '{}' });
  assert.equal(code, 1);
  assert.match(stderr, /expected an array/);
  assert.match(stderr, /Invalid input:/);
});

test('prepare: exits 1 via InputError when file JSON is not an array', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'object.json');
  await writeFile(inputFile, '{}', 'utf8');
  const { code, stderr } = await runCli(['prepare', '--project', 'a/b', inputFile]);
  assert.equal(code, 1);
  assert.match(stderr, /expected an array/);
  assert.match(stderr, /Invalid input:/);
});

test('prepare: reads raw ESLint JSON from stdin when no positional given', async () => {
  const { code, stderr, stdout } = await runCli(
    ['prepare', '--project', 'acme/demo', '--cwd', '/proj'],
    { input: JSON.stringify(rawFixture()) }
  );
  assert.equal(code, 0, `exit code was ${code}; stderr: ${stderr}`);
  const parsed = JSON.parse(stdout);
  assert.equal(parsed.project, 'acme/demo');
  assert.deepEqual(parsed.rules['no-unused-vars'].files, ['src/a.js:10', 'src/a.js:22']);
});

test('prepare: exits 1 on invalid JSON from stdin (reports source as stdin)', async () => {
  const { code, stderr } = await runCli(['prepare'], { input: 'not-json' });
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON in stdin/);
});

test('prepare: exits 1 when the input file cannot be read', async () => {
  const { code, stderr } = await runCli(['prepare', '/definitely/does/not/exist.json']);
  assert.equal(code, 1);
  assert.match(stderr, /could not read/);
});

test('prepare: exits 1 on invalid JSON input', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'bad.json');
  await writeFile(inputFile, 'not-json', 'utf8');
  const { code, stderr } = await runCli(['prepare', inputFile]);
  assert.equal(code, 1);
  assert.match(stderr, /invalid JSON/);
});

test('aggregate: emits "all N pass" on empty results directory', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stdout } = await runCli(['aggregate', '--project-count', '5', results]);
  assert.equal(code, 0);
  assert.match(stdout, /All 5 external projects pass/);
});

test('aggregate: clean-run message names the ESLint versions from --eslint-versions', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stdout } = await runCli(
    ['aggregate', '--project-count', '32', '--eslint-versions', '9.22,10', results]
  );
  assert.equal(code, 0);
  assert.match(stdout, /✅ All 32 external projects pass on eslint 9.22 and 10\n$/);
});

test('aggregate: clean-run message sanitizes markup and control chars in --eslint-versions', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stdout } = await runCli(
    ['aggregate', '--project-count', '2', '--eslint-versions', '9.22,<b>10</b>,\u001B[31m11\u001B[0m', results]
  );
  assert.equal(code, 0);
  assert.match(stdout, /&lt;b&gt;10&lt;\/b&gt;/, 'markup must be HTML-escaped');
  assert.doesNotMatch(stdout, /<b>10<\/b>/, 'no raw markup may reach the message');
  assert.ok(!stdout.includes('\u001B'), 'no raw escape char may reach the message');
});

test('aggregate: --eslint-versions parsing handles single, spaced, and empty segments', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const single = await runCli(['aggregate', '--project-count', '2', '--eslint-versions', '9.22', results]);
  assert.equal(single.code, 0);
  assert.match(single.stdout, /on eslint 9\.22\n$/, 'single version, no "and"');
  const spaced = await runCli(['aggregate', '--project-count', '2', '--eslint-versions', '9.22, 10', results]);
  assert.equal(spaced.code, 0);
  assert.match(spaced.stdout, /on eslint 9\.22 and 10\n$/, 'whitespace segments trimmed');
  const empty = await runCli(['aggregate', '--project-count', '2', '--eslint-versions', ',', results]);
  assert.equal(empty.code, 0);
  assert.match(empty.stdout, /✅ All 2 external projects pass\n$/, 'empty segments drop the clause');
});

test('aggregate: clean-run message reads ESLint versions from EFS_ESLINT_VERSIONS env', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stdout } = await runCli(
    ['aggregate', '--project-count', '2', results],
    { env: { EFS_ESLINT_VERSIONS: '9.22' } }
  );
  assert.equal(code, 0);
  assert.match(stdout, /on eslint 9\.22\n$/);
});

test('aggregate: renders the eslint version in the project label from the artifact', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    eslintVersion: '9.22',
    errorCount: 2,
    rules: { 'no-unused-vars': { errors: 2, warnings: 0, fixable: 0, files: ['src/a.js:10'] } },
  });
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /\(eslint 9\.22\)/);
});

test('aggregate: renders fleet sticky-PR-comment from per-project artifacts', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 2,
    warningCount: 1,
    fixableWarningCount: 1,
    rules: { 'no-unused-vars': { errors: 2, warnings: 0, fixable: 0, files: ['src/a.js:10', 'src/a.js:22'] } },
  });
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /## External project test results/);
  assert.match(stdout, /acme\/demo/);
  assert.match(stdout, /no-unused-vars/);
  assert.match(stdout, /blob\/HEAD\/src\/a\.js#L10/);
  // Pin the numeric headline — a regression that dropped or swapped counts
  // would still match all the existing assertions above.
  assert.match(stdout, /2 errors \(0 fixable\), 1 warnings \(1 fixable\)/);
});

test('aggregate: --sort-by severity orders projects by error count desc', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/alpha',
    errorCount: 1,
    rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  await writeOneProjectArtifact(results, {
    project: 'acme/zeta',
    errorCount: 5,
    rules: { foo: { errors: 5, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  const { stdout: alphabetical } = await runCli(['aggregate', results]);
  const { stdout: severity } = await runCli(['aggregate', '--sort-by', 'severity', results]);
  assert.ok(alphabetical.indexOf('acme/alpha') < alphabetical.indexOf('acme/zeta'), 'alphabetical: alpha before zeta');
  assert.ok(severity.indexOf('acme/zeta') < severity.indexOf('acme/alpha'), 'severity: zeta (5 errors) before alpha (1 error)');
});

test('aggregate: --sort-by severity breaks ties by warnings then project', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // Equal errorCounts exercise the warningCount tie-break; equal warnings
  // fall through to the byProject comparator.
  await writeOneProjectArtifact(results, {
    project: 'acme/alpha',
    errorCount: 1,
    warningCount: 2,
    rules: { foo: { errors: 1, warnings: 2, fixable: 0, files: ['a.js:1'] } },
  });
  await writeOneProjectArtifact(results, {
    project: 'acme/beta',
    errorCount: 1,
    warningCount: 1,
    rules: { foo: { errors: 1, warnings: 1, fixable: 0, files: ['a.js:1'] } },
  });
  await writeOneProjectArtifact(results, {
    project: 'acme/gamma',
    errorCount: 1,
    warningCount: 1,
    rules: { foo: { errors: 1, warnings: 1, fixable: 0, files: ['a.js:1'] } },
  });
  const { stdout } = await runCli(['aggregate', '--sort-by', 'severity', results]);
  assert.ok(stdout.indexOf('acme/alpha') < stdout.indexOf('acme/beta'), 'alpha (2 warnings) before beta (1 warning)');
  assert.ok(stdout.indexOf('acme/beta') < stdout.indexOf('acme/gamma'), 'equal warnings fall back to project order');
});

test('aggregate: --sort-by with invalid value exits 1 via InputError', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stderr } = await runCli(['aggregate', '--sort-by', 'bogus', results]);
  assert.equal(code, 1);
  assert.match(stderr, /--sort-by must be "project" or "severity"/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: exits 1 via InputError when no positional argument is given', async () => {
  const { code, stderr } = await runCli(['aggregate']);
  assert.equal(code, 1);
  assert.match(stderr, /expected at least one <results-dir>/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: exits 1 via InputError when given multiple positional arguments', async () => {
  const { code, stderr } = await runCli(['aggregate', 'a.json', 'b.json']);
  assert.equal(code, 1);
  assert.match(stderr, /no more than one <results-dir>/);
  assert.match(stderr, /Invalid input:/);
});

test('aggregate: exits 1 with no success banner when every candidate artifact is skipped', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // One subdir with a malformed JSON artifact — passes the stat check but
  // fails JSON.parse, so readResultsDirectory returns zero valid results.
  // A 100% skip rate is a misconfiguration, not a clean run: the CLI must
  // exit non-zero without emitting the "all N pass" banner.
  const subdir = path.join(results, 'proj-a');
  await mkdir(subdir, { recursive: true });
  await writeFile(path.join(subdir, 'eslint-result.json'), 'not-json', 'utf8');
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 1);
  assert.doesNotMatch(stdout, /All .* external projects pass/, 'no success banner on 100% skip');
  assert.match(stderr, /Invalid input: all 1 candidate artifact\(s\) in .+ were skipped/);
});

test('aggregate: exits 1 when every candidate has an invalid result shape', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // Valid JSON but all fail isValidProjectResult (project must be a string) —
  // the misconfiguration UX is exactly this scenario, and the throw is
  // reason-agnostic so it must fire here too.
  for (const name of ['proj-a', 'proj-b']) {
    const subdir = path.join(results, name);
    await mkdir(subdir, { recursive: true });
    await writeFile(path.join(subdir, 'eslint-result.json'), JSON.stringify({ project: 123, rules: {} }), 'utf8');
  }
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 1);
  assert.doesNotMatch(stdout, /All .* external projects pass/, 'no success banner on 100% skip');
  assert.match(stderr, /Invalid input: all 2 candidate artifact\(s\) in .+ were skipped/);
});

test('aggregate: rejects zero-count artifact with empty rules as invalid', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // A zero-count artifact with empty rules is not a valid ProjectResult —
  // prepareProjectResult returns undefined on zero findings, so this shape
  // is either tampered or from a non-conforming third-party tool.
  const subdir = path.join(results, 'proj-a');
  await mkdir(subdir, { recursive: true });
  await writeFile(
    path.join(subdir, 'eslint-result.json'),
    JSON.stringify({ project: 'a/b', errorCount: 0, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, rules: {} }),
    'utf8'
  );
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 1);
  assert.doesNotMatch(stdout, /All .* external projects pass/, 'no success banner for rejected zero-count artifact');
});

test('aggregate: escapes control characters in skipped-artifact paths on stderr', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // A forged subdir name carrying a terminal-control sequence must not reach
  // stderr raw — it is escaped as \x1b so it cannot forge log lines.
  const evilSubdir = path.join(results, 'bad\u001B[2Jname');
  await mkdir(evilSubdir, { recursive: true });
  await writeFile(path.join(evilSubdir, 'eslint-result.json'), 'not-json', 'utf8');
  const { code, stderr } = await runCli(['aggregate', results]);
  assert.equal(code, 1);
  assert.ok(!stderr.includes('\u001B'), 'no raw control char may reach stderr');
  assert.match(stderr, /bad\\x1b\[2Jname/, 'control char escaped as literal \\x1b');
});

test('aggregate: warns per skipped candidate with path and reason while keeping valid results', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // One valid artifact and one malformed one — the valid project must still
  // render while the malformed candidate is surfaced on stderr with its path
  // and skip reason (a partial skip would otherwise be silent).
  await writeOneProjectArtifact(results, {
    project: 'acme/good',
    errorCount: 1,
    rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  const badSubdir = path.join(results, 'acme-bad');
  await mkdir(badSubdir, { recursive: true });
  await writeFile(path.join(badSubdir, 'eslint-result.json'), 'not-json', 'utf8');
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /acme\/good/, 'valid artifact must still render');
  assert.match(stderr, /skipped .*acme-bad.*eslint-result\.json \(unreadable or unparseable JSON\)/);
  assert.doesNotMatch(stderr, /all \d+ candidate artifact\(s\).*were skipped/, 'aggregate warning only fires on 100% skip');
});

test('aggregate: warns with reason when an artifact is oversize (>5 MB)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/good',
    errorCount: 1,
    rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  const fatSubdir = path.join(results, 'acme-fat');
  await mkdir(fatSubdir, { recursive: true });
  await writeFile(path.join(fatSubdir, 'eslint-result.json'), 'x'.repeat(5 * 1024 * 1024 + 1), 'utf8');
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /acme\/good/, 'valid artifact must still render');
  assert.match(stderr, /skipped .*acme-fat.*eslint-result\.json \(oversize >5 MB\)/);
});

test('aggregate: warns with reason when an artifact has an invalid result shape', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/good',
    errorCount: 1,
    rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: ['a.js:1'] } },
  });
  const badSubdir = path.join(results, 'acme-shape');
  await mkdir(badSubdir, { recursive: true });
  // Valid JSON but fails isValidProjectResult (project must be a string).
  await writeFile(path.join(badSubdir, 'eslint-result.json'), JSON.stringify({ project: 123, rules: {} }), 'utf8');
  const { code, stderr, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.match(stdout, /acme\/good/, 'valid artifact must still render');
  assert.match(stderr, /skipped .*acme-shape.*eslint-result\.json \(invalid result shape\)/);
});

test('aggregate: exits 1 when all candidates are non-file paths (directories, symlinks)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // Create a subdir whose eslint-result.json is itself a directory (not a
  // file), which should count as a skipped candidate and trigger the
  // AllSkippedError on 100% skip rate.
  const subdir = path.join(results, 'proj-a');
  const artifactPath = path.join(subdir, 'eslint-result.json');
  await mkdir(artifactPath, { recursive: true });
  const { code, stderr } = await runCli(['aggregate', results]);
  assert.equal(code, 1);
  assert.match(stderr, /Invalid input: all 1 candidate artifact\(s\) in .+ were skipped/);
  assert.match(stderr, /skipped .*eslint-result\.json \(not a regular file\)/);
});

test('aggregate: exits 1 when results directory is missing (no silent all-pass)', async () => {
  const { code, stderr } = await runCli(['aggregate', '/definitely/does/not/exist']);
  assert.equal(code, 1);
  assert.match(stderr, /results directory not found/);
});

// Table-driven numeric-flag validation — each case stays individually named
// and reportable via the interpolated title.
for (const [label, argv, rx] of /** @type {Array<[string, string[], RegExp]>} */ ([
  ['non-numeric --size-cap', ['--size-cap', 'abc'], /--size-cap must be a positive integer/],
  ['negative --size-cap', ['--size-cap=-5'], /--size-cap must be a positive integer/],
  ['zero --size-cap', ['--size-cap', '0'], /--size-cap must be a positive integer/],
  ['fractional --file-cap', ['--file-cap', '1.5'], /--file-cap must be a positive integer/],
])) {
  test(`aggregate: exits 1 via InputError on ${label}`, async (t) => {
    const tmp = await tmpDir(t);
    const results = path.join(tmp, 'results');
    await mkdir(results, { recursive: true });
    const { code, stderr } = await runCli(['aggregate', ...argv, results]);
    assert.equal(code, 1);
    assert.match(stderr, rx);
  });
}

test('aggregate: --size-cap triggers truncation end-to-end with tail-summary block', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // Three projects × 30 files is enough to exceed a tight sizeCap once
  // HEADROOM is subtracted. sizeCap < HEADROOM(15000) guarantees truncation.
  for (let i = 0; i < 3; i++) {
    await writeOneProjectArtifact(results, {
      project: `acme/proj-${i}`,
      errorCount: 1,
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: 30 }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
    });
  }
  const { code, stdout } = await runCli(['aggregate', '--size-cap', '3000', results]);
  assert.equal(code, 0);
  assert.match(stdout, /<summary>Tail projects \(\d+ truncated/, 'tail-summary block should appear when truncation fires');
  assert.match(stdout, /file:line detail truncated for tail projects/, 'trailer sentence should appear');
});

test('aggregate: $GITHUB_STEP_SUMMARY env var has no effect (callers redirect --full explicitly)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 2,
    rules: { foo: { errors: 2, warnings: 0, fixable: 0, files: ['a.js:1', 'a.js:2'] } },
  });
  const stepSummary = path.join(tmp, 'step-summary.md');
  const { code, stdout } = await runCli(['aggregate', results], {
    env: { GITHUB_STEP_SUMMARY: stepSummary },
  });
  assert.equal(code, 0);
  assert.match(stdout, /acme\/demo/);
  // Assert the step-summary file never got written. `stat` rejects with ENOENT
  // on missing paths — that's the signal we want.
  await assert.rejects(() => stat(stepSummary), /ENOENT/, 'aggregate must not auto-write to $GITHUB_STEP_SUMMARY');
});

test('aggregate: --full emits uncapped markdown (no tail-summary trailer)', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  // 80 files × 5 projects — enough to defeat the default fileCap=50 and
  // exercise the `--full` bypass. Probe set [0, 49, 50, 79] keeps the
  // boundary-at-50 assertion; halves the fixture from the previous 200.
  const FILES_PER_RULE = 80;
  for (let i = 0; i < 5; i++) {
    await writeOneProjectArtifact(results, {
      project: `acme/proj-${i}`,
      errorCount: 1,
      rules: { foo: { errors: 1, warnings: 0, fixable: 0, files: Array.from({ length: FILES_PER_RULE }, (_, j) => `src/a-${j}.js:${j + 1}`) } },
    });
  }
  // Do NOT pass --file-cap — if --full does not bypass the default cap=50
  // the `… and 30 more` overflow trailer appears and ~30 entries per rule
  // are silently dropped.
  const { code, stdout } = await runCli(['aggregate', '--full', '--size-cap', '20000', results]);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, /<summary>Tail projects/);
  assert.doesNotMatch(stdout, /file:line detail truncated/);
  assert.doesNotMatch(stdout, /… and \d+ more/, '--full must not emit the per-rule file-cap overflow trailer');
  for (let i = 0; i < 5; i++) assert.match(stdout, new RegExp(`acme/proj-${i}`));
  for (const j of [0, 49, 50, 79]) {
    assert.match(stdout, new RegExp(`src/a-${j}\\.js:${j + 1}`), `file index ${j} must appear under --full`);
  }
});

test('aggregate: scrubs secret-shaped strings in rule ids and file paths', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  const ghToken = 'ghp_' + 'A'.repeat(40);
  const ghoToken = 'gho_' + 'C'.repeat(40);
  const ghrToken = 'ghr_' + 'D'.repeat(36);
  const fineGrained = 'github_pat_' + 'E'.repeat(22) + '_' + 'F'.repeat(59);
  const npmToken = 'npm_' + 'B'.repeat(40);
  const awsKey = 'AKIAIOSFODNN7EXAMPLE';
  await writeOneProjectArtifact(results, {
    project: 'acme/demo',
    errorCount: 5,
    rules: {
      [`rule-${ghToken}`]: { errors: 1, warnings: 0, fixable: 0, files: [`src/${npmToken}.js:1`] },
      [`rule-${ghoToken}`]: { errors: 1, warnings: 0, fixable: 0, files: ['src/b.js:1'] },
      [`rule-${ghrToken}`]: { errors: 1, warnings: 0, fixable: 0, files: ['src/c.js:1'] },
      [`rule-${fineGrained}`]: { errors: 1, warnings: 0, fixable: 0, files: ['src/d.js:1'] },
      [`rule-${awsKey}`]: { errors: 1, warnings: 0, fixable: 0, files: ['src/e.js:1'] },
    },
  });
  const { code, stdout } = await runCli(['aggregate', results]);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, new RegExp(ghToken));
  assert.doesNotMatch(stdout, new RegExp(ghoToken));
  assert.doesNotMatch(stdout, new RegExp(ghrToken));
  assert.doesNotMatch(stdout, new RegExp(fineGrained));
  assert.doesNotMatch(stdout, new RegExp(npmToken));
  assert.doesNotMatch(stdout, new RegExp(awsKey));
  assert.match(stdout, /\[REDACTED\]/);
});

test('aggregate: --sort-by with control characters encodes them in stderr', async (t) => {
  const tmp = await tmpDir(t);
  const results = path.join(tmp, 'results');
  await mkdir(results, { recursive: true });
  const { code, stderr } = await runCli(['aggregate', '--sort-by', '\u001B[2Jevil', results]);
  assert.equal(code, 1);
  assert.match(stderr, /sort-by/);
  assert.ok(!stderr.includes('\u001B'), 'no raw control char in stderr');
  assert.ok(stderr.includes('\\x1b'), 'control char is visibly escaped in stderr');
});

test('aggregate: results-dir with control characters encodes them in stderr', async (t) => {
  const tmp = await tmpDir(t);
  // Create a directory whose name contains a control character — the ENOENT
  // / ENOTDIR path reaches InputError which reaches console.error.
  const evilDir = path.join(tmp, 'res\u001B[2Jults');
  const { code, stderr } = await runCli(['aggregate', evilDir]);
  assert.equal(code, 1);
  assert.ok(!stderr.includes('\u001B'), 'no raw control char in stderr');
  assert.ok(stderr.includes('\\x1b'), 'control char is visibly escaped in stderr');
});

test('prepare: empty input file with control chars in path encodes them in stderr', async (t) => {
  const tmp = await tmpDir(t);
  const evilFile = path.join(tmp, 'in\u001B[2Jput.json');
  await writeFile(evilFile, '   \n  ', 'utf8');
  const { code, stderr } = await runCli(['prepare', '--project', 'a/b', evilFile]);
  assert.equal(code, 1);
  assert.match(stderr, /empty/);
  assert.ok(!stderr.includes('\u001B'), 'no raw control char in stderr');
  assert.ok(stderr.includes('\\x1b'), 'control char is visibly escaped in stderr');
});

test('bin: no subcommand exits non-zero with help text (PeowlyCommandMissingError)', async () => {
  const { code, stdout, stderr } = await runCli([]);
  assert.ok(code !== 0, `expected non-zero exit, got ${code}`);
  // showHelp writes to stdout in peowly-commands
  const output = stdout + stderr;
  assert.match(output, /eslint-summary/);
  assert.match(output, /prepare|aggregate/);
});

test('bin: unknown flag exits 1 with Invalid input (ERR_PARSE_ARGS_UNKNOWN_OPTION)', async () => {
  const { code, stderr } = await runCli(['prepare', '--bogus']);
  assert.equal(code, 1);
  assert.match(stderr, /Invalid input:/);
});

test('bin: write failure exits 1 with Unexpected error', async (t) => {
  const tmp = await tmpDir(t);
  const inputFile = path.join(tmp, 'input.json');
  const raw = JSON.stringify([{ filePath: '/proj/a.js', errorCount: 1, warningCount: 0, fixableErrorCount: 0, fixableWarningCount: 0, messages: [{ ruleId: 'no-undef', severity: 2, line: 1, column: 1, message: 'x' }] }]);
  await writeFile(inputFile, raw, 'utf8');
  // --out points to a nonexistent directory — writeFile fails with ENOENT,
  // propagates as an unclassified error through the bin catch handler.
  const { code, stderr } = await runCli(['prepare', '--project', 'a/b', '--out', path.join(tmp, 'no-such-dir', 'out.json'), inputFile]);
  assert.equal(code, 1);
  assert.match(stderr, /Unexpected error/);
});
