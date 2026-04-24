## Feature Requests

- **Expose custom mdast-util-to-markdown handlers through the public options type** (2026-04-21) —
  `MdastToChalkOrMarkdownOptions` currently only exposes `tablePipeAlign`, so consumers
  cannot pass arbitrary handlers to `mdast-util-to-markdown` via `fromMdast()`. This
  blocks adopting the package for rendering any MDAST tree that contains `break` /
  `softBreak` / `hardBreak` nodes inside a `tableCell` — the default handler throws
  `Cannot handle unknown node 'softBreak'` when it encounters one inside a GFM pipe-table
  cell. Relevant for this project because the upcoming per-project markdown output mode
  (THE_PLAN.md PR 3) wants multi-line file lists inside table cells, and would otherwise
  have benefited from adopting `markdown-or-chalk` end-to-end instead of extending the
  current hand-rolled template-literal renderer.
  Ownership: upstream · Workaround: full — emit `<br>` as literal text inside cells
  (GFM accepts raw HTML in pipe-table cells), or hand-roll the markdown renderer entirely
  without going through MDAST; this project is taking the latter path for PR 3.

## Bugs

_No entries yet._

## Upstream Opportunities

_No entries yet._
