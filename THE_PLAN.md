# The Plan: eslint-formatter-summary Synergy Epic

> Authoritative plan: /Users/pelle/.claude/plans/harmonic-cuddling-piglet.md
> Synergy doc: ../eslint-config-voxpelli/SYNERGY-eslint-formatter-summary.md
> Last updated: 2026-04-21

## Locked decisions

- Full 5-step synergy roadmap as the highest-priority epic
- Step 1 split: 1a hardening (fix, patch) → 1b classifier (feat!, major)
- Missing-rule: regex re-bucket with extracted name per-file
- Type shape: discriminated union on MessageSummary (kind + id)
- Step 3 renderer: decide at PR 2 merge time (adopt markdown-or-chalk vs hand-rolled)
- Tracking: this file (no beads initialized)
- Regex safety: fallback bucket only; no peerDep tightening; no CI matrix
- Releases: manual release-please merging; user-driven cadence

## Status

| PR   | Title                                                         | Status | Blocked-by               | URL | Release |
|------|---------------------------------------------------------------|--------|--------------------------|-----|---------|
| P0.1 | Create THE_PLAN.md                                            | ✅     | —                        | —   | n/a     |
| P0.2 | Correct SYNERGY doc lines 38-42                               | ✅     | —                        | —   | n/a     |
| P0.3 | BM note: deferred ideas + revival triggers                    | ✅     | —                        | —   | n/a     |
| PR 1a+1b | fix+feat!: harden markdown + classify non-rule messages   | 🟠     | P0.1                     | [#24](https://github.com/voxpelli/eslint-formatter-summary/pull/24) | major   |
| PR 2 | feat: table-cell break handlers (markdown-or-chalk)           | ⬜     | —                        | —   | minor   |
| PR 3 | feat: EFS_OUTPUT=markdown-per-project                         | ⬜     | PR 1b + PR 2 published   | —   | minor   |
| PR 4 | feat: EFS_REPO_SLUG + sticky-PR-comment mode                  | ⬜     | PR 3                     | —   | minor   |
| PR 5 | refactor(canary): adopt eslint-formatter-summary              | ⬜     | PR 4 published           | —   | n/a     |

Legend: ⬜ not started · 🟡 in progress · 🟠 in review · ✅ merged · 🔴 blocked

## PR detail

### PR 1a — fix: harden markdown output against injection
- Branch: `fix/markdown-injection-hardening`
- AC: npm run check + test:node + test:real-world green; new fixtures for `</details>` / `javascript:` / HTML-special; CHANGELOG auto-generated
- Notes:

### PR 1b — feat!: classify non-rule messages into synthetic-key buckets
- Branch: `feat/synthetic-key-classifier`
- AC: five synthetic keys appear in output when applicable; footnote renders only when synthetic rows exist; discriminated union passes type-coverage ≥99%; BREAKING CHANGE footer documents the MessageSummary migration
- Notes:

### PR 2 — feat: table-cell break handlers (markdown-or-chalk)
- Branch: `feat/table-cell-break-handlers`
- AC: break/softBreak/hardBreak nodes inside a GFM table cell emit `<br>`; existing tests pass; published as v0.3.0 after merge
- Notes:

### PR 3 — feat: EFS_OUTPUT=markdown-per-project
- Branch: `feat/markdown-per-project-output`
- AC: per-project `<details>` blocks render correctly for multi-project fixtures; existing `EFS_OUTPUT=markdown` mode unchanged; runtime-dep decision recorded here before work begins
- **Architectural decision (pending): adopt markdown-or-chalk runtime dep? [yes/no] — rationale: …**
- Notes:

### PR 4 — feat: EFS_REPO_SLUG + sticky-PR-comment mode
- Branch: `feat/sticky-pr-comment-mode`
- AC: file paths become clickable anchors when EFS_REPO_SLUG is set; oversized output capped with tail-summary; invalid slug falls back to plain text
- Notes:

### PR 5 — refactor(canary): adopt eslint-formatter-summary
- Branch: `refactor/adopt-eslint-formatter-summary`
- AC: canary CI runs green on representative fixture; `tools/prepare-eslint-result.js` and `tools/generate-canary-comment.js` deleted; no dangling references
- Notes:

## Deferred (revival triggers)

- SARIF-native reducer / fleet telemetry — revive if canary fleet doubles, or multi-linter aggregation requested, or code-scanning compliance
- Parquet/DuckDB weekend experiment — revive if time-series view becomes a pain point
- CI matrix across ESLint minors — revive on first silent-reclassification report
- index.cjs `appendFile` try/catch — small follow-up PR after epic closes
- peerDependencies.eslint upper bound — follow-up per locked decision
- Rename `find-rule.js` → `find-summary.js` — optional; ASK-FIRST
- `MessageSummary` Map-index for very large runs — only if profiling shows the linear scan is hot
