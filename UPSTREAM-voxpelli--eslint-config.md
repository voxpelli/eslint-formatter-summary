## Feature Requests

- **Lint enforcement for `@see` / `{@link}` convention** (2026-04-21) — Project
  convention (see CLAUDE.md and BM `engineering/tooling/jsdoc-see-and-link-proper-usage`)
  is to use `{@link symbol}` for imported symbols, `{@link https://url|Label}`
  for URLs, and free-text `@see` for cross-module refs — never relative-path
  `{@link ./foo.js}` forms, which don't navigate in VS Code. Enforcement is
  currently manual; a rule would catch regressions on every file edit. How
  eslint-config-voxpelli delivers this is its call — adopt the future
  eslint-plugin-jsdoc rule (tracked at gajus/eslint-plugin-jsdoc#1631), a
  custom rule, or a different plugin entirely.
  Ownership: upstream · Workaround: full — project convention documented in CLAUDE.md and applied by hand

## Bugs

_No entries yet._

## Upstream Opportunities

_No entries yet._
