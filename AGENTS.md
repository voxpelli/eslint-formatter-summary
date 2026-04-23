# AGENTS.md

GitHub Copilot instructions for `@voxpelli/eslint-formatter-summary`.

For full project context and usage details, see [`README.md`](./README.md).

## Project at a glance

- ESLint formatter that aggregates lint results by rule
- Output modes: CLI (chalk), markdown-table, CSV
- Includes `eslint-summary` CLI with `prepare` + `aggregate` subcommands
- Peer dep: ESLint `>=9.13.0` (flat configs)
- Node: `^22.13.0 || >=24.0.0`

## High-signal commands

Run these after code changes:

- `npm run check` — lint + type + knip + installed-check + type-coverage
- `npm run test:node` — unit tests with coverage
- `npm run test:real-world` — self-host formatter on `lib/`
- `npm test` — full check + tests (preferred before finalizing)

Default scripts use compact output on purpose (`dot` reporter, `--skip-full` coverage, no type-coverage detail) to keep logs and agent context lean.

When you need more detail to diagnose a failure:

```sh
# Full TAP output (see which specific test failed and why)
npx c8 node --test --test-reporter spec 'test/**/*.spec.js'

# Per-file coverage table (find which files lack coverage)
npx c8 report --reporter=text

# Type-coverage with every uncovered identifier listed
npx type-coverage --detail --strict --at-least 99 --ignore-files 'test/*'
```

## Architecture constraints

- `index.cjs` is the required CJS entrypoint for ESLint formatter loading (`require` contract).
- `lib/*.js` and `lib/cli/*.js` are ESM modules.
- Keep the two-layer model:
  - entrypoint/env orchestration in `index.cjs`
  - implementation in `lib/`
- Aggregation pipeline lives in `lib/`:
  - message extraction/classification → aggregation → sorting → output formatting

## Code conventions

- Use ESM syntax in `lib/` (do not add CommonJS there)
- Keep `index.cjs` as the sole CommonJS file
- CLI command modules in `lib/cli/` use named exports (`cmdPrepare`, `cmdAggregate`); avoid default exports for new or refactored command modules
- Follow neostandard style via `@voxpelli/eslint-config`
- Types are JSDoc-annotated and validated by `tsc` (no compile step)
- Keep type coverage expectations high (`type-coverage` target: 99%)
- JSDoc style:
  - symbol links: `{@link symbol}`
  - URL links: `{@link https://example.com|Label}`
  - avoid relative-path links in JSDoc
- Type-only imports should use JSDoc `@import` blocks after runtime imports

## Security and output handling

- Sanitization (`lib/sanitize-untrusted.js`) is intentionally applied to markdown/HTML-like render paths.
- Do not add sanitization to CSV or chalk terminal branches unless requirements change.
- Preserve GitHub step-summary behavior in `index.cjs` (`GITHUB_STEP_SUMMARY` integration).

## Change guardrails

- Keep changes minimal and targeted; avoid broad refactors unless requested.
- Add/update tests when behavior changes.
- For export/rename refactors, use symbol/reference lookup before editing imports manually.
- Do not bypass failing checks.
- Use conventional commits.
- Do not use GPG signing when committing.

## Pointers for deeper details

- User-facing feature docs and CLI usage: [`README.md`](./README.md)
- Package scripts and runtime constraints: [`package.json`](./package.json)
