# The Plan: eslint-formatter-summary Synergy Epic

> Authoritative plan: /Users/pelle/.claude/plans/harmonic-cuddling-piglet.md
> Synergy doc: ../eslint-config-voxpelli/SYNERGY-eslint-formatter-summary.md
> Last updated: 2026-04-21

## Locked decisions

- Full 5-step synergy roadmap as the highest-priority epic
- Step 1 split: 1a hardening (fix, patch) → 1b classifier (feat!, major)
- Missing-rule: regex re-bucket with extracted name per-file
- Type shape: discriminated union on MessageSummary (kind + id)
- **Architecture pivot (2026-04-21, post-PR-1)**: Rescoped PR 3/PR 4 into a
  companion CLI (`eslint-summary` bin via `peowly-commands`) rather than
  additional formatter output modes. The ESLint formatter remains the main
  export; the CLI absorbs the sibling's bespoke tools via `prepare` +
  `aggregate` subcommands. PR 2 (markdown-or-chalk break-handler contribution)
  is dropped — hand-rolled rendering is used throughout the CLI.
- Tracking: this file (no beads initialized)
- Regex safety: fallback bucket only; no peerDep tightening; no CI matrix
- Releases: manual release-please merging; user-driven cadence

## Status

| PR   | Title                                                         | Status | Blocked-by               | URL | Release |
|------|---------------------------------------------------------------|--------|--------------------------|-----|---------|
| P0.1 | Create THE_PLAN.md                                            | ✅     | —                        | —   | n/a     |
| P0.2 | Correct SYNERGY doc lines 38-42                               | ✅     | —                        | —   | n/a     |
| P0.3 | BM note: deferred ideas + revival triggers                    | ✅     | —                        | —   | n/a     |
| PR 1a+1b | fix+feat!: harden markdown + classify non-rule messages   | ✅     | P0.1                     | [#24](https://github.com/voxpelli/eslint-formatter-summary/pull/24) | major   |
| PR 2 | ~~markdown-or-chalk break handlers~~                          | ❌ dropped | —                     | n/a | n/a     |
| PR 3 | feat: add eslint-summary CLI (prepare + aggregate)            | 🟠     | PR 1b                    | [#26](https://github.com/voxpelli/eslint-formatter-summary/pull/26) | minor   |
| PR 4 | refactor(canary): consume eslint-summary, delete bespoke tools (eslint-config-voxpelli) | ⬜ | PR 3 published | —  | n/a     |

Legend: ⬜ not started · 🟡 in progress · 🟠 in review · ✅ merged · ❌ dropped · 🔴 blocked

## PR detail

### PR 3 — feat: add eslint-summary CLI (prepare + aggregate)
- Branch: `feat/eslint-summary-cli`
- Absorbs:
  - `../eslint-config-voxpelli/tools/prepare-eslint-result.js` → `efs prepare`
  - `../eslint-config-voxpelli/tools/generate-canary-comment.js` → `efs aggregate`
- Runtime dep additions: `peowly`, `peowly-commands`
- Dev dep bumps: `@voxpelli/eslint-config` → ^25 for the `cliFiles` option
- AC:
  - `eslint-summary prepare <raw.json>` emits `ProjectResult` JSON matching the sibling shape
  - `eslint-summary aggregate <results-dir>` emits the sticky-PR-comment markdown with truncation; `--full` emits uncapped markdown (caller redirects to `$GITHUB_STEP_SUMMARY` explicitly)
  - `eslint-summary prepare` reads from stdin when no `<input-file>` positional is given (`eslint --format json | eslint-summary prepare`)
  - Untrusted strings (rule ids, file paths, message details) pass through length-cap + secret-scrub before HTML escape
  - Formatter entry (`index.cjs`) and `lib/format-results.js` behavior unchanged
  - Full test suite green, including the real-world self-host
  - File-path entries include `:line` only in CLI output (not in formatter markdown)
- Notes: Architecture pivot consolidated former PR 3 (per-project output), PR 4 (sticky comment), and PR 5 (canary adoption's library-consumer side) into a single CLI feat minor release.

### PR 4 — refactor(canary): consume eslint-summary, delete bespoke tools
- Repo: `eslint-config-voxpelli`
- Branch: `refactor/adopt-eslint-summary`
- AC: canary workflow invokes `eslint-summary prepare` in matrix jobs and `eslint-summary aggregate` in the summary job; both `tools/prepare-eslint-result.js` and `tools/generate-canary-comment.js` deleted; grep finds no dangling references; canary CI runs green on a representative fixture.
- Notes: Depends on PR 3 being published to npm.

## Deferred (revival triggers)

- SARIF-native reducer / fleet telemetry — revive if canary fleet doubles, or multi-linter aggregation requested, or code-scanning compliance
- Parquet/DuckDB weekend experiment — revive if time-series view becomes a pain point
- CI matrix across ESLint minors — revive on first silent-reclassification report
- `peerDependencies.eslint` upper bound — follow-up per locked decision
- Rename `find-rule.js` → `find-summary.js` — optional; ASK-FIRST
- `MessageSummary` Map-index for very large runs — only if profiling shows the linear scan is hot
- `markdown-or-chalk` upstream break-handler contribution — tracked separately in `UPSTREAM-markdown-or-chalk.md`; unblock path for any future MDAST-based rendering
