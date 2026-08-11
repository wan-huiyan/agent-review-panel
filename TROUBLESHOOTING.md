# Troubleshooting

Common problems and recoveries. For first-time install help, see
[Quick Start](README.md#quick-start). For migrating from an older install
handle, see [MIGRATION.md](MIGRATION.md).

## After install, `/roundtable:agent-review-panel` is not recognized

Restart your Claude Code session — skills load at session start, not on
install completion. If the slash command still doesn't appear after restart,
see "Old version keeps loading" below.

## The panel ran but no output files appeared

The three output files (`review_panel_report.md`, `review_panel_process.md`,
`review_panel_report.html`) are written to your Claude Code session's
**current working directory**. Run `pwd` in the session to confirm where you
are. If you start the session from one directory and `cd` elsewhere, files
land in the original cwd. Only one panel can run per directory at a time —
concurrent runs in the same directory will overwrite each other.

Output filenames and location are not configurable. To keep multiple reviews,
rename or move the three `review_panel_*` files (or `cd` to a fresh
directory) before the next run.

## A finding looks wrong or overstated

The panel will sometimes produce a wrong finding — the
[epistemic-label system](README.md#reading-the-report) exists to help you
triage it:

- Findings tagged `[STATIC-INFERENCE]`, `[UNVERIFIED]`, `[DISPUTED]`, or
  `[SINGLE-SOURCE]` are the ones to scrutinise first.
- `⚠️ HUMAN REVIEW RECOMMENDED` on the executive summary means the judge
  itself flagged the verdict as low-confidence.
- `[JUDGE-HALLUCINATED]` on an action item means the post-judge gate caught
  the judge introducing a finding the panel never raised and ground-truth
  contradicted it — discount that item heavily.
- To test the stability of an unsure finding, re-run with `--runs 3` and
  check the `[K/N RUNS]` stability label on the merged report.

## Old version keeps loading after `claude plugin update`

A loose clone in `~/.claude/skills/agent-review-panel/` shadows the
marketplace install and pins you to whatever version was cloned. Verify,
back up, then remove:

```bash
ls ~/.claude/skills/agent-review-panel 2>/dev/null && \
  mv "$HOME/.claude/skills/agent-review-panel" "$HOME/.claude/skills/agent-review-panel.bak.$(date +%s)"
```

Then restart Claude Code. The marketplace install in
`~/.claude/plugins/cache/agent-review-panel/` will take over. The backup is
reversible — delete it once you've confirmed the marketplace version works.

## `claude plugin update` doesn't seem to apply

Clean reinstall as a fallback:

```bash
claude plugin uninstall roundtable@agent-review-panel
claude plugin marketplace remove agent-review-panel
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

If state from a pre-v3.0 install is interfering, see
[MIGRATION.md](MIGRATION.md#stale-state-cleanup-when-uninstall-isnt-enough).

## `review_panel_report.html` is missing or empty

Phase 15.3 generates the HTML in a separate pass and may retry once on
transient failures. If still missing after a run, the markdown report
contains the same findings — the HTML is a presentation layer. To regenerate
the HTML manually, ask Claude Code in the same session:
*"generate the HTML review report"*.

## The HTML report renders unstyled or charts are blank

The dashboard pulls Tailwind, Chart.js, and Prism.js from CDN; first open
requires internet. For air-gapped review, use `review_panel_report.md` — same
content, no CDN dependency. (The three CDN libraries are MIT-licensed.)

## `npm test` fails locally with `Cannot find module 'node:test'` or similar

The test suite uses Node's built-in test runner, which requires **Node ≥ 18**
(stable from 20). Check with `node --version` and upgrade if needed.

## Panel hangs partway through Phase 3

A reviewer subagent may have timed out. The panel doesn't auto-retry across
runs — interrupt the session and re-invoke the panel. If it reproduces,
file an issue (see [Support](README.md#support)) with the content type
(code/plan/docs) and approximate size.

## A `reviewer_<slug>_BLOCKED.md` file appeared in the state directory

That reviewer could not reach the work under review — usually a reviewer
subagent provisioned without `Bash`, so it could not run `gh pr diff` or
`git checkout`. It writes that file *instead of* its own phase file on purpose,
so the panel counts it as a missing reviewer rather than reading a content-free
"no findings" review as agreement. The panel re-dispatches it once with explicit
paths; if it is still blocked, the report carries the ⚠️ COMPRESSED RUN banner
and that persona's findings are absent. Open the file — it names what the
reviewer tried — then re-run with the branch checked out or a pre-generated diff
file on disk.

## Update appears to work but old behavior persists

Same root cause as "Old version keeps loading" above — a loose
`~/.claude/skills/agent-review-panel/` clone shadowing the marketplace
install. The verify/back-up/remove recipe above applies.
