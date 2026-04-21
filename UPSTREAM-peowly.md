## Feature Requests

- **Ship `type: 'number'` flag support** (2026-04-21) — `lib/flag-types.d.ts` shows
  the Meow-extension `NumberFlag` commented out (`// type NumberFlag = Flag<'number', number> …`).
  Consumers building CLIs that take numeric flags (`--size-cap 60000`,
  `--project-count 25`, `--file-cap 50`) have to either declare them as
  `type: 'string'` and pass through `Number()` at use time, or hand-roll a
  validation helper that exits 2 on NaN. We do the latter in
  `lib/cli/cmd-aggregate.js` (`parseNumericFlag`). When peowly ships the
  extension, the helper can be deleted and the flag config becomes
  self-documenting for tsc.
  Ownership: upstream · Workaround: full — a ~10-LOC validator per CLI.

## Bugs

_No entries yet._

## Upstream Opportunities

_No entries yet._
