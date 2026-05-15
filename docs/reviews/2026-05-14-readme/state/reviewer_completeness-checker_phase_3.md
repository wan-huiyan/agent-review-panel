# Phase 3 — Independent Review: Completeness Checker

**Reviewer:** Completeness Checker (agreement intensity 40%, exhaustive mode, checklist verification)
**Target:** `/home/user/agent-review-panel/README.md` (671 lines)
**Date:** 2026-05-14

## Score: 6/10 (completeness)

The README is long and covers install/migration/troubleshooting in exhaustive depth. But it is lopsided: operational mechanics are over-documented while several things a *first-time evaluator* needs are missing or buried — no text sample of an actual report, no surfaced "when NOT to use," a thin contributing section, no support channel, and a release story that is silently broken (plugin says v3.3.0; zero git tags exist; the README's own verification steps point users at a "latest release" that does not exist).

---

## Findings

### P1-1 — No text sample of an actual report or finding
**Gap:** The README describes the three output files extensively (sections at lines 90-95, 298-314) and links to demo GIFs, but never shows a single finding, action-item row, or `review_panel_report.md` snippet *as text*. A reader cannot tell what they will actually receive. The GIFs are images (not copy-pasteable, not accessible, not indexed by search), and `docs/archive/review_panel_report.md` is a real sample that exists in-repo but is **never linked**.
**Where it should live:** New collapsible block in "Quick Start" under "What you get," or a "Sample Output" subsection before "How It Works."
**Why a reader needs it:** This is the single biggest "should I run this?" question. Worked output is the most persuasive content a tool README can have, and one already exists unlinked in the repo.
**Fix:** Add a `<details>` block with ~15 lines of a real Action Items table + one disagreement-with-judge-ruling excerpt, lifted from `docs/archive/review_panel_report.md`. Link that file explicitly: "See a full real report: [docs/archive/review_panel_report.md]."

### P1-2 — Release/versioning story is broken and unactionable
**Gap:** `package.json` and `.claude-plugin/plugin.json` declare v3.3.0; the Version History table documents v3.1/v3.2/v3.3. But `git tag` returns **zero tags** — there is no v3.2.0 or v3.3.0 (or any) GitHub release. Meanwhile the README tells users (lines 148-152, 479-483) to verify their install by comparing the cache directory name against "the [latest GitHub release]" and `gh release view`. Those checks will report a mismatch or fail for every user on v3.2+.
**Where it should live:** "Updating to the latest version" (lines 129-154) and the release badge at line 1.
**Why a reader needs it:** A user following the documented verification flow will conclude their install is broken when it is not. This is an actively misleading instruction.
**Fix:** Either cut releases for v3.2.0/v3.3.0, or change the verification instruction to compare against `package.json` / `.claude-plugin/plugin.json` version (or `CHANGELOG.md` top entry) instead of GitHub releases, and note that releases may lag `main`.

### P1-3 — "When NOT to use" is not surfaced; it's buried in SKILL.md
**Gap:** `skills/agent-review-panel/SKILL.md` has a strong, specific "When NOT to Use This Skill" section (single code review, quick sanity checks, bug fixes, "what do you think?", etc.). The README only has scattered fragments — line 377 ("Not for quick code reviews...") and line 13. There is no consolidated decision section near the top, and SKILL.md's list is never linked.
**Where it should live:** A short "When to use / When not to use" block right after the hero/intro, or folded into "Why Use a Panel."
**Why a reader needs it:** Cost is $3-$20 per run. Telling someone clearly *not* to run it for a quick review saves them money and a bad first impression. The content already exists; it just needs surfacing.
**Fix:** Add a two-column "Use it for / Don't use it for" block up high, sourced verbatim from SKILL.md's list.

### P1-4 — No support channel / "where to get help" section
**Gap:** Nowhere does the README say where to report a bug, ask a question, or get help. "Contributing" (line 605) says "open an issue to discuss before submitting large PRs" and Troubleshooting (line 548) says "file an issue" once, in passing — but there is no Support/Help section, no link to GitHub Issues, no Discussions, no issue-template pointer.
**Where it should live:** A dedicated "Support" section near the end (before or after Contributing).
**Why a reader needs it:** When a review hangs or produces a wrong finding, the user needs an obvious, findable path to report it. Right now they have to infer it.
**Fix:** Add a "Support" section: link to GitHub Issues with a one-line "include content type + size" guidance, and Discussions if enabled.

### P1-5 — Contributing section too thin for a contributor to actually start
**Gap:** "Contributing" (lines 597-605) lists *what* help is wanted but nothing about *how*: no dev setup, no "clone and run `npm test`" pointer (tests are documented in a separate section at 405-423 but not linked from Contributing), no Node version requirement restated here, no PR process, no pointer to where `SKILL.md` lives or how the skill/manifest layout works, no mention of `scripts/release-check.sh` or the manifest invariants a PR must not break.
**Where it should live:** Expand "Contributing."
**Why a reader needs it:** A would-be contributor (the README explicitly solicits Cursor adaptation and new signal groups) has no on-ramp.
**Fix:** Add: "Dev setup: clone (not into `~/.claude/skills/`), `npm test` (requires Node ≥18), edit `skills/agent-review-panel/SKILL.md`, run `scripts/release-check.sh` before release. PRs: open an issue first for large changes." Link the Tests section and `HOW_WE_BUILT_THIS.md`.

### P2-6 — Output customization (filenames / location) not documented as configurable — because it isn't, but that's not stated
**Gap:** The README states output filenames are fixed (`review_panel_report.md` etc.) and land in the session cwd, overwriting prior files (lines 386, 521). What it never answers: *can I change the filename or directory?* A reader wanting to keep a history of reviews, or run two reviews, has no guidance beyond "run one panel at a time per directory."
**Where it should live:** "Known Limitations → Output location" or "Configuration / Modes."
**Why a reader needs it:** Overwrite-by-default with no rename option is a real workflow constraint; users need to know to manually copy/rename outputs between runs.
**Fix:** State explicitly: "Output filenames and location are not configurable. To keep multiple reviews, rename or move the three `review_panel_*` files (or `cd` to a fresh directory) before the next run."

### P2-7 — Failure mode: "the panel produced a wrong finding" is not addressed
**Gap:** Troubleshooting covers install/loading/HTML/hang failures, but not the most consequential failure: *the review itself is wrong.* The CHANGELOG's own v3.3.0 entry describes a real false-P0 incident. The epistemic-label system (lines 576-593) is the tool for acting on uncertain findings, but the README never says "if a finding looks wrong, check its epistemic label and defect type; `[STATIC-INFERENCE]`/`[UNVERIFIED]`/`[DISPUTED]` findings are the ones to scrutinize; `HUMAN REVIEW RECOMMENDED` flags low-judge-confidence verdicts."
**Where it should live:** New Troubleshooting entry: "A finding looks wrong or overstated."
**Why a reader needs it:** Multi-agent reviews *will* sometimes be wrong; the README markets verification heavily but gives no recovery guidance for when verification fails.
**Fix:** Add a Troubleshooting entry tying the symptom to the epistemic-label/defect-type system and the `HUMAN REVIEW RECOMMENDED` flag, with "re-run with `--runs 3` to test finding stability."

### P2-8 — Prerequisites are scattered across four locations and inconsistent
**Gap:** Requirements appear in at least four places: line 13 (surfaces), lines 99-117 ("Requires Claude Code"), lines 206-208 ("Claude Code version requirement"), lines 399-403 ("Prerequisites"), and line 544 (Node ≥18, only in a Troubleshooting entry). Node version is *not* in the Prerequisites section at all — it only appears in a troubleshooting footnote. OS support is never stated anywhere.
**Where it should live:** Consolidate into the "Prerequisites" section (line 399).
**Why a reader needs it:** A reader checking "can I run this?" should find one complete list, not assemble it from five fragments. Node ≥18 is a hard requirement for contributors/manual users and is effectively hidden.
**Fix:** Make "Prerequisites" the single source: Claude Code v1.0+, a supported surface (link the surfaces list), Claude Pro/Max or API access, Node ≥18 (for tests/manual clone), OS (state "macOS/Linux/Windows — anywhere Claude Code runs" or whatever is true), VoltAgent optional.

### P2-9 — Comparison vs. Claude Code's built-in `/review` is missing
**Gap:** "Why Use a Panel Instead of a Single Reviewer?" (lines 235-247) compares against ad-hoc "review this code." But Claude Code ships a built-in `/review` command and many readers will already use it. The README never positions itself against that specific, named alternative.
**Where it should live:** "Why Use a Panel."
**Why a reader needs it:** The honest question is "I already have `/review` — why pay $10 for this?" Not answering it leaves the value proposition incomplete.
**Fix:** Add a sentence/row contrasting with built-in single-pass `/review`: panel adds independent multi-persona review, adversarial debate, judge adjudication, verification layer, and epistemic labeling — at higher cost/latency; use `/review` for routine, the panel for high-stakes.

### P2-10 — Cost section omits what drives cost and has an unverifiable pricing basis
**Gap:** The cost table (lines 369-377) gives dollar figures "at current Opus pricing" but never states the assumed per-token rate, so the numbers can't be checked or updated by the reader. It mentions reviewer count auto-scales 4-6 but doesn't connect that to the cost ranges. It also doesn't mention that `deep` mode and VoltAgent specialist agents add cost, or that the Multi-Run Union `--runs 3` triples it (the table says "3× base" but that's easy to miss).
**Where it should live:** "Cost & Performance."
**Why a reader needs it:** "~$10" is meaningless without the rate; pricing changes and the reader needs to recompute.
**Fix:** State the assumed rate ("assumes Opus at $X/$Y per Mtok input/output, as of 2026-05") and a one-line "what drives cost: reviewer count (signal density), content size, debate rounds, `deep` mode, `--runs N` multiplier."

### P3-11 — Privacy/security is one bullet; no consolidated statement, no telemetry/data-retention answer
**Gap:** "Privacy & network" (line 385) covers outbound HTTPS from deep-research/Phase-11 and defers data handling to "Claude Code's standard data-handling policy" — but doesn't link that policy, doesn't state whether the plugin itself collects any telemetry/analytics (it appears not to — worth saying so explicitly), and doesn't address data retention of the output files (they're local, but that's only implied).
**Where it should live:** Either expand the "Privacy & network" bullet or add a short "Privacy" section.
**Why a reader needs it:** Anyone reviewing proprietary code needs an explicit, linkable answer. "Subject to Claude Code's policy" with no link is a dead end.
**Fix:** Add: link to Anthropic/Claude Code data-handling docs; state "the plugin sends no telemetry of its own"; state "all three output files are written locally and never transmitted by the plugin"; reaffirm deep/web-verify modes are the only outbound calls and are skippable.

### P3-12 — Accessibility / non-terminal users not addressed for the primary content (the GIFs)
**Gap:** The README's main illustrations of *what the tool produces* are three animated GIFs (lines 15-19). There is no text alternative to the demo content itself (alt text exists but only names the image, doesn't convey the content). The HTML report's own accessibility is described (keyboard nav, print CSS), but the README's presentation of its value is image-only.
**Where it should live:** Pair with the fix for P1-1 (text sample doubles as the accessible alternative).
**Why a reader needs it:** Screen-reader users, users on slow/metered connections, and users viewing on platforms that don't autoplay GIFs get none of the demo's value.
**Fix:** Adding the text report sample (P1-1) resolves this; also ensure GIF alt text is descriptive.

### P3-13 — Licensing of *outputs* and bundled-CDN libraries not stated together
**Gap:** The repo is MIT (line 658). The HTML report bundles Tailwind/Chart.js/Prism.js via CDN — line 540 notes in passing they're "MIT-licensed," but this is in a Troubleshooting entry, not the License section. Nothing states the *output files you generate* are yours to use freely (obvious, but worth one line for anyone reviewing client code).
**Where it should live:** "License" section.
**Why a reader needs it:** A user generating reports for a client wants explicit confirmation there are no strings on the output.
**Fix:** Add to License: "Reports you generate are yours. The HTML dashboard loads Tailwind, Chart.js, and Prism.js from CDN — all MIT-licensed."

### P3-14 — No "uninstall also clears state" guidance / migration leftovers
**Gap:** "Uninstalling" (lines 607-620) covers the marketplace/clone uninstall commands but doesn't mention the `~/.claude/plugins/marketplaces/`, `~/.claude/plugins/cache/`, or `~/.claude/skills/` leftovers that the *Migration* and *Troubleshooting* sections spend dozens of lines cleaning up. A user who uninstalls and later reinstalls hits the exact stale-state problem the README documents elsewhere.
**Where it should live:** "Uninstalling."
**Why a reader needs it:** Consistency — the README treats stale state as a major hazard everywhere except the one section where the user is actively removing the plugin.
**Fix:** Add a "Clean uninstall (remove all cached state)" note pointing to the same paths as the Migration cleanup recipe.

---

## Top 3 Most Defensible

1. **P1-2 (broken release/versioning story)** — Objectively verifiable: `git tag` is empty, plugin is v3.3.0, and the README explicitly instructs users to verify against GitHub releases. Not an opinion.
2. **P1-1 (no text report sample)** — A real sample (`docs/archive/review_panel_report.md`) exists in-repo and is unlinked; the README shows output only as GIFs. Concrete, easy to confirm, easy to fix.
3. **P1-3 (when-NOT-to-use buried)** — SKILL.md has the content; the README doesn't surface or link it. The brief explicitly flagged this and it checks out.

## Least Defensible

1. **P3-12 (accessibility of GIFs)** — Real but largely subsumed by P1-1; on its own it's a stretch to call a separate finding.
2. **P3-13 (output licensing)** — Mostly obvious from MIT; one line of polish, low reader impact.
3. **P3-11 (telemetry/data retention)** — The README does address privacy/network; the gap is depth and a missing link, not absence. A reasonable maintainer could call the existing bullet "sufficient."

## Verdict

Operationally exhaustive but evaluator-hostile: the README never shows what a report looks like, buries "when not to use," lacks a support channel, and ships verification instructions that point at GitHub releases which don't exist.
