# Changelog

## [5.0.0](https://github.com/voxpelli/eslint-formatter-summary/compare/v4.2.0...v5.0.0) (2026-04-21)


### ⚠ BREAKING CHANGES

* MessageSummary is now a discriminated union with `kind` ('rule' | 'synthetic') and a shared `id` field (the rule ID for kind='rule', a parenthesized synthetic key otherwise). The previous `ruleId` property is gone. The string 'syntax error' no longer appears in output — parser errors now render as (parser error). Consumers reaching for `.ruleId` on summary rows must narrow on `kind === 'rule'` and read `.id` instead. CSV output shape is unchanged (still errors,warnings,fixable,rule), but the value in the rule column may now be a synthetic key.

### 🩹 Fixes

* harden markdown output and classify non-rule messages ([#24](https://github.com/voxpelli/eslint-formatter-summary/issues/24)) ([56297c6](https://github.com/voxpelli/eslint-formatter-summary/commit/56297c6b07f236a90c61cb81b158ac91c738d973))

## [4.2.0](https://github.com/voxpelli/eslint-formatter-summary/compare/v4.1.0...v4.2.0) (2026-04-20)


### 🌟 Features

* write markdown summary to $GITHUB_STEP_SUMMARY ([#21](https://github.com/voxpelli/eslint-formatter-summary/issues/21)) ([bb8ba2a](https://github.com/voxpelli/eslint-formatter-summary/commit/bb8ba2ae98a0bb93c400fab7c8e7050d4e6c068f))


### 🧹 Chores

* add node:test + c8 unit test suite ([#22](https://github.com/voxpelli/eslint-formatter-summary/issues/22)) ([e1f1a26](https://github.com/voxpelli/eslint-formatter-summary/commit/e1f1a26fa3e404cf977d3a7463a26e763fe5c8d9))

## [4.1.0](https://github.com/voxpelli/eslint-formatter-summary/compare/v4.0.0...v4.1.0) (2026-04-16)


### 🌟 Features

* add fixable column and CSV output format ([#18](https://github.com/voxpelli/eslint-formatter-summary/issues/18)) ([4104296](https://github.com/voxpelli/eslint-formatter-summary/commit/4104296c4b794d8d958a2a9dded7140dae970801))


### 📚 Documentation

* reorder and enhance badge section in README ([061c747](https://github.com/voxpelli/eslint-formatter-summary/commit/061c7478c5ce4a8be884da6f9dde6818948c072a))


### 🧹 Chores

* fix renovate config ([e6eaa5c](https://github.com/voxpelli/eslint-formatter-summary/commit/e6eaa5c572f7747350ae906edece3ae791e1d8fc))
* update dependency terminal-link to v5 ([#19](https://github.com/voxpelli/eslint-formatter-summary/issues/19)) ([b847881](https://github.com/voxpelli/eslint-formatter-summary/commit/b8478819b895ab768e9408738237dbd1abb36c10))
