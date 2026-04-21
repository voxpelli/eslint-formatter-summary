# @voxpelli/eslint-formatter-summary

[ESLint](https://eslint.org) formatter aggregating results by rule.

[![npm version](https://img.shields.io/npm/v/@voxpelli/eslint-formatter-summary.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/eslint-formatter-summary)
[![npm downloads](https://img.shields.io/npm/dm/@voxpelli/eslint-formatter-summary.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/eslint-formatter-summary)
[![neostandard javascript style](https://img.shields.io/badge/code_style-neostandard-7fffff?style=flat&labelColor=ff80ff)](https://github.com/neostandard/neostandard)
[![Module type: ESM](https://img.shields.io/badge/module%20type-esm-brightgreen)](https://github.com/voxpelli/badges-cjs-esm)
[![Types in JS](https://img.shields.io/badge/types_in_js-yes-brightgreen)](https://github.com/voxpelli/types-in-js)
[![Follow @voxpelli@mastodon.social](https://img.shields.io/mastodon/follow/109247025527949675?domain=https%3A%2F%2Fmastodon.social&style=social)](https://mastodon.social/@voxpelli)

Fork of [mhipszki/eslint-formatter-summary](https://github.com/mhipszki/eslint-formatter-summary).

## Features

- aggregated errors / warnings / fixable count **per rule**
- **sort by** rule name, number of errors or warnings
- output as **markdown table** or **CSV**
- **`eslint-summary` CLI** for fan-in aggregation across many projects (see [CLI](#cli))

## TL;DR

This formatter simply aggregates the ESLint results _by rule_ and shows the following output:

<img width="715" alt="eslint-output-example-summary" src="https://user-images.githubusercontent.com/220661/28670748-ff4cff36-72d1-11e7-8fc0-b0d6a12c69ea.png">

It can also be configured to sort results by rule, errors or warnings using env vars e.g.

```shell
EFS_SORT_BY=rule EFS_SORT_DESC=true eslint -f @voxpelli/eslint-formatter-summary ./src
```

(see details below).

## How to install

```shell
npm i -D @voxpelli/eslint-formatter-summary
```

## Requirements

| Tool       | Version                           | Field in [`package.json`](package.json) |
| ---------- | --------------------------------- | ------------------------- |
| Node.js    | The LTS releases of Node.js       | `engines.node`            |
| TypeScript | Version `>=5.9` (optional)        | `engines.typescript`      |
| ESLint     | Version `>=9` (only flat configs) | `peerDependencies.eslint` |

## How to use

When you run ESLint specify `@voxpelli/eslint-formatter-summary` as the formatter (see [ESLint CLI documentation](http://eslint.org/docs/user-guide/command-line-interface#-f---format)):

```shell
eslint -f @voxpelli/eslint-formatter-summary [file|dir|glob]*
```

## Intention

It is a matter of minutes to add ESLint to a new project, however it can be quite challenging to introduce it (or just add a stricter rule set) to _existing projects_, already large codebases.

Possibly hundreds if not thousands of errors will pop up which can seem overwhelming to be fixed when we see the default formatted output, forcing us to back up from making our code base better / more consistent.

This package provides a custom ESLint formatter to help in these situations to make the right decisions by showing the linting results aggregated by rule. It gives an overview of all rules failing showing the total number of errors and warnings summed up by rule.

Having this _summary_ overview can give us the opportunity e.g. to consider suppressing certain rules for now and bringing them back in later when we are ready to fix them.

## Output format

With the default ESLint formatter you might get several thousands of lines of failing rules in various files in the output e.g.:

<img width="715" alt="eslint-output-example-default" src="https://user-images.githubusercontent.com/220661/28670749-ff50aae6-72d1-11e7-8458-da73ae458cd2.png">

The Summary Formatter simply aggregates the ESLint results _by rule_ and shows the following output instead:

<img width="715" alt="eslint-output-example-summary" src="https://user-images.githubusercontent.com/220661/28670748-ff4cff36-72d1-11e7-8fc0-b0d6a12c69ea.png">

In the above example we can notice that the `comma-dangle` rule is responsible for about 2/3 of the failures, so we can consider turning it off or just suppressing it to a warning for now as we can do so with the other failing rules.

### Sorting output

> Default sorting is by `errors` in a `descending` order

Configuration options can be passed to the formatter to alter the output.

Using the`EFS_SORT_BY` env var the aggregated results can be sorted by either `rule`, `errors` or `warnings` e.g.

```shell
EFS_SORT_BY=rule eslint -f @voxpelli/eslint-formatter-summary ./src
```

sorted string results are shown in ASCENDING order by default and numbers in DESCENDING order, but the order can be reversed using `EFS_SORT_REVERSE=true`:

```shell
EFS_SORT_BY=rule EFS_SORT_REVERSE=true eslint -f @voxpelli/eslint-formatter-summary ./src
```

### Markdown output

To output the summary as a markdown table, set `EFS_OUTPUT=markdown`

```shell
EFS_OUTPUT=markdown eslint -f @voxpelli/eslint-formatter-summary ./src
```

Example:

| Errors | Warnings | Fixable | Rule            |
| ------ | -------- | ------- | --------------- |
|      1 |        - |       1 | <details><summary>[no-const-assign](https://eslint.org/docs/rules/no-const-assign)</summary><ul><li>test.js</li></ul></details> |
|      1 |        - |       - | <details><summary>[no-undef](https://eslint.org/docs/rules/no-undef)</summary><ul><li>test.js</li></ul></details> |
|      1 |        - |       - | <details><summary>[no-unused-vars](https://eslint.org/docs/rules/no-unused-vars)</summary><ul><li>test.js</li></ul></details> |

The raw example markdown:

```markdown
| Errors | Warnings | Fixable | Rule            |
| ------ | -------- | ------- | --------------- |
|      1 |        - |       1 | <details><summary>[no-const-assign](https://eslint.org/docs/rules/no-const-assign)</summary><ul><li>test.js</li></ul></details> |
|      1 |        - |       - | <details><summary>[no-undef](https://eslint.org/docs/rules/no-undef)</summary><ul><li>test.js</li></ul></details> |
|      1 |        - |       - | <details><summary>[no-unused-vars](https://eslint.org/docs/rules/no-unused-vars)</summary><ul><li>test.js</li></ul></details> |
```

### CSV output

To output the summary as CSV, set `EFS_OUTPUT=csv`

```shell
EFS_OUTPUT=csv eslint -f @voxpelli/eslint-formatter-summary ./src
```

Example:

```csv
errors,warnings,fixable,rule
1,0,1,"no-const-assign"
1,0,0,"no-undef"
1,0,0,"no-unused-vars"
```

### GitHub Actions

When running under GitHub Actions, the formatter automatically appends its markdown output to [`$GITHUB_STEP_SUMMARY`](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#adding-a-job-summary), so failing rules surface on the job summary page. This happens regardless of `EFS_OUTPUT` — stdout still uses whatever format you configured.

- Skipped when the run is clean (no errors and no warnings).
- Opt out with `EFS_GITHUB_STEP_SUMMARY=false` (or `0`) — useful for jobs that should only emit the formatter's stdout.
- If the write fails (e.g. read-only path), a warning is logged to stderr but the lint run continues.

## CLI

The package also ships an `eslint-summary` CLI, intended for fan-in scenarios where many projects are linted separately (e.g. a matrix GitHub Actions workflow) and the individual runs need to be aggregated into one sticky PR comment or one job summary.

Two subcommands:

### `eslint-summary prepare [input-file]`

Reduces one project's raw `eslint --format json` output into an intermediate `ProjectResult` JSON blob. Reads from `<input-file>` or from stdin when no positional is given.

```shell
# From a file
eslint-summary prepare --project owner/repo project/eslint-results.json > result.json

# Piped
eslint --format json | eslint-summary prepare --project owner/repo > result.json
```

Flags: `--project <owner/repo>` (or env `EFS_PROJECT_NAME`), `--out <path>` (default `-` = stdout), `--cwd <path>` (strip-prefix for relative file paths).

### `eslint-summary aggregate <results-dir>`

Fans N `ProjectResult` JSON files (one per subdirectory) into a sticky-PR-comment markdown document.

```shell
# Write a capped comment body for sticky-PR-comment posting
eslint-summary aggregate --project-count 25 --out comment.md results/

# Uncapped output to the GitHub Actions job summary
eslint-summary aggregate --full results/ >> "$GITHUB_STEP_SUMMARY"
```

Flags: `--full` (uncapped markdown), `--project-count <n>` (for "all N pass" message; env `EXTERNAL_PROJECT_COUNT`), `--out <path>`, `--sort-by <project|severity>`, `--size-cap <bytes>` (default 60000; env `EFS_SIZE_CAP`), `--file-cap <n>` (per-rule file-entry cap, default 50).

### Defensive sanitization

Rule ids, file paths, and message details rendered into markdown output (both CLI and formatter paths) pass through a sanitization layer that:

- Strips bidi / zero-width control codepoints (defense against trojan-source rendering).
- Scrubs substrings matching known secret shapes (`ghp_…` / `ghs_…` / `ghu_…` / `npm_…` / AWS `AKIA…` / PEM block headers) with `[REDACTED]`.
- Caps string length so a pathological rule name cannot distort the rendered table.

This is defense-in-depth: a misbehaving ESLint plugin or an attacker-authored fork PR (in a canary / fleet-lint setup) should not be able to echo tokens back via the PR sticky comment or the Actions job summary. The CSV branch is unaffected (machine output) and the terminal-colored branch is unaffected (no HTML rendering surface).

## Contribute

Please feel free to submit an issue describing your proposal you would like to discuss. PRs are also welcome!

### Run unit tests

```
npm test
```

### Test build project

Once the project is built the distribution version can be tested via passing a `.js` file to `npm run try`.

For example:

```
npm run try test.js
```

### CI build

The project is built on GitHub Actions targeting each supported Node.js versions (see the list above).

During the CI build all source files are linted and all unit tests need to pass resulting in a coverage report.

## License

MIT
