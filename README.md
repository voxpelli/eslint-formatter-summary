[![npm version](https://img.shields.io/npm/v/@voxpelli/eslint-formatter-summary.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/eslint-formatter-summary)
[![npm downloads](https://img.shields.io/npm/dm/@voxpelli/eslint-formatter-summary.svg?style=flat)](https://www.npmjs.com/package/@voxpelli/eslint-formatter-summary)

# @voxpelli/eslint-formatter-summary

> [ESLint](https://eslint.org) formatter aggregating results by rule

Fork of [mhipszki/eslint-formatter-summary](https://github.com/mhipszki/eslint-formatter-summary) pending the [upstreaming of some/all changes](https://github.com/mhipszki/eslint-formatter-summary/pull/39).

## Features

- aggregated errors / warnings **per rule**
- **sort by** rule name, number of errors or warnings
- _NEW:_ output **markdown**

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

## How to use

When you run ESLint just specify `@voxpelli/eslint-formatter-summary` as the formatter:

```shell
eslint -f @voxpelli/eslint-formatter-summary [file|dir|glob]*
```

See http://eslint.org/docs/user-guide/command-line-interface#-f---format

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

> Default sorting is by `rule` in an `ascending` order

Configuration options can be passed to the formatter to alter the output.

Using the`EFS_SORT_BY` env var the aggregated results can be sorted by either `rule`, `errors` or `warnings` e.g.

```shell
EFS_SORT_BY=rule eslint -f @voxpelli/eslint-formatter-summary ./src
```

the sorted results are shown in ASCENDING order by default but the order can also be reversed using `EFS_SORT_DESC=true`:

```shell
EFS_SORT_BY=rule EFS_SORT_DESC=true eslint -f @voxpelli/eslint-formatter-summary ./src
```

### Changing output format

To output the summary as a markdown table, set `EFS_OUTPUT=markdown`

```shell
EFS_OUTPUT=markdown eslint -f @voxpelli/eslint-formatter-summary ./src
```

Example:

| Errors | Warnings | Rule            |
| ------ | -------- | --------------- |
|      1 |        0 | <details><summary>[no-const-assign](https://eslint.org/docs/rules/no-const-assign)</summary><ul><li>test.js</li></ul></details> |
|      1 |        0 | <details><summary>[no-undef](https://eslint.org/docs/rules/no-undef)</summary><ul><li>test.js</li></ul></details> |
|      1 |        0 | <details><summary>[no-unused-vars](https://eslint.org/docs/rules/no-unused-vars)</summary><ul><li>test.js</li></ul></details> |

## Supported Node versions

This project targets the current LTS releases of Node.js. See [`engines.node` in `package.json`](package.json).

## Supported ESLint versions

`ESLint` versions are supported from `v8` onwards.

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
