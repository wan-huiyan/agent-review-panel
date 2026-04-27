# Review Panel Report

**Work reviewed:** README restructure proposal (`readme_restructure_proposal.md`) vs. current `README.md`
**Date:** 2026-04-27
**Panel:** 4 reviewers + Auditor + Judge
**Verdict:** **Reject — re-scope to tighten-in-place** | **Confidence:** High
**Auto-detected signals:** Documentation review, no domain signals
**Review mode:** Exhaustive (auto-detected from content type: pure documentation)
**Data flow trace:** Skipped (pure docs, no transforms)
**Codebase state:** main at v3.0.0 (just tagged 2026-04-27); worktree clean
**Runs:** 1 (single-run mode)

## Executive Summary

**Final score: 4/10.** The proposal correctly diagnoses a real readability problem — Quick Start is overloaded at ~133 lines — but its prescribed cure is wrong. The three specific deletions it proposes (CLI equivalent block, `@<marketplace-name>` callout, "Why the marketplace path?" paragraph) are a **verbatim inversion of PR #20's documented "Kept" list** from 8 days ago. Two sources independently record that PR #20's dedupe pass deliberately preserved exactly these three items: `CHANGELOG.md:171` and `HOW_WE_BUILT_THIS.md:726`. The proposal cites neither.

Worse, one of the deletions silently neuters a CI lint: `scripts/release-check.sh:80` greps the README for the literal string `"marketplace name is"` — i.e., the very callout the proposal would delete. The grep would return empty after deletion, the lint would still pass, but its documented invariant becomes a tautology.

The right path is the conservative one DA proposed and CE conceded to in Round 1: **tighten prose in place, don't delete deliberately-preserved content, and add a two-way invariant between the README and the CI lint** so a future restructure can't repeat this mistake.

## Scope & Limitations

**What was reviewed:** the proposal document, the current README, and the project's recent decision history (CHANGELOG, HOW_WE_BUILT_THIS, ROADMAP, scripts/release-check.sh).

**What CANNOT be evaluated:** real reader behavior on the live README, search-engine impact, accessibility on actual screen readers, GitHub.com rendering vs. local. **Structural limitation:** all reviewers are Claude instances; shared model bias means unanimous agreement (which we did NOT have here — score spread 4-7) is not necessarily ground truth.

**Epistemic labels used:** [VERIFIED] (line-grep confirmed), [CONSENSUS] (4-way), [SINGLE-SOURCE: judge] (judge-only finding), [VERIFIED-REFUTED] (claim tested and contradicted), [DISPUTED] (panel disagreed).

**Defect type:** [PLAN_RISK] — the proposal has not been executed; findings predict consequences if it ships.

## Score Summary

| Reviewer | Persona | Intensity | Round 0 | Round 1 | Final Position |
|---|---|---|---|---|---|
| Clarity Editor | First-principles | 60% | 7 | 6.5 | Approve with revisions, prefers merge |
| Technical Accuracy | Systematic enumeration | 30% | 6 | 7 | Approve with revisions (rhetoric-flagged by judge) |
| Completeness Checker | Checklist verification | 40% | 5.5 | 4 | Reject as written |
| Devil's Advocate | Analogical reasoning | 20% | 4 | 5 | Reject as written, prefers tighten-in-place |
| **Supreme Judge** | — | — | — | — | **Reject, re-scope. 4/10. High confidence.** |

## Consensus Points

- **Quick Start IS overloaded.** ~133 lines (proposal said 93 — verified incorrect by Tech Accuracy). The diagnosis is real.
- **The proposal as written should NOT ship.** All four reviewers agree after Round 1.
- **`CHANGELOG.md:171` is dispositive.** Verbatim quote: *"Kept the CLI equivalent, the `@<marketplace-name>` callout, and the 'Why the marketplace path?' explanation."* — this is exactly what the proposal deletes.

## Disagreement Points (with judge rulings)

### Disagreement 1: Approve-with-revisions vs. Reject-and-replace
- **Side A (CE, TA):** "Approve with revisions" — the strategic instinct is right, fix the line numbers and PR #20 citation, ship.
- **Side B (CC, DA):** "Reject" — when revisions would share almost no content with what was submitted, that's a rejection plus a new plan, not a revision.
- **Judge ruling:** **Side B.** When a proposal inverts two written prior decisions, neuters a CI lint, and inflates its own savings ~2.5×, "Approve with revisions" understates how much must change. Honest labeling: reject, then write a new plan.

### Disagreement 2: Merge vs. Tighten-in-place as the right alternative
- **Side A (CE Round 1):** Merge Quick Start + Installation into one section.
- **Side B (DA Round 0+1, CE Round 1 concession):** Keep both sections, tighten prose in place.
- **Judge ruling:** **Side B (tighten-in-place).** Merge is a larger structural change with bigger anchor-stability blast radius (would invalidate `#installation` itself, the most-linked anchor). Tighten preserves all anchors and respects PR #20's documented intent.

### Disagreement 3: DA's OSS-README empirical claim
- **DA Round 0:** React/FastAPI/Next.js/Tailwind/esbuild/Vite/Astro all repeat install commands without "see above" deferrals.
- **TA Round 1 verification:** Spot-checked 6 of 7. **5 of 6 defer to external docs** (React, Next.js, Vite, esbuild, Tailwind — NO install commands in README at all). Astro has a single Install section. Only FastAPI repeats across sections.
- **Judge ruling:** **[VERIFIED-REFUTED].** DA's specific claim is wrong. But the dominant pattern (defer-to-canonical) actually supports the proposal's *direction* (single canonical install location) while undermining its *execution* (deletion of valuable callouts).

## Completeness Audit Findings (Phase 8)

The audit found 12 items the panel missed. The four most important:

1. **[P1] [VERIFIED] `scripts/release-check.sh:80` greps for the literal string "marketplace name is"** — the very callout the proposal deletes. Deletion silently neuters CI invariant #2. Strongest single finding in the review.

2. **[P1] [VERIFIED] HOW_WE_BUILT_THIS.md:726 corroborates CHANGELOG.md:171** — a SECOND source documenting PR #20's "Kept" list. The decision-reversal critique is now backed by two independent files.

3. **[P2] [VERIFIED] Proposal's "~50 lines saved" arithmetic is loose.** Realistic net savings: ~20 lines. The 50 assumed deleting the entire `### Claude Code marketplace (recommended)` subsection (~30 lines) — but the subsection's intro paragraph SURVIVES as the proposed pointer block.

4. **[P2] [VERIFIED] No table of contents exists in this README.** Only GitHub's auto-generated outline. The proposal's anticipated objection #1 ("TOC click lands in middle of Installation") is moot because there's no TOC.

Additional audit findings 5-12 (tagline blockquote redundancy, README:11 + #requires-claude-code deep-link, Path A's recovery-flow origin, Uninstalling section's parallel structure dependency, etc.) appear in the full Process History.

## Coverage Gaps (judge's independent scan)

- **[P2] [SINGLE-SOURCE: judge] Failure-mode SEO** — the deleted `@<marketplace-name>` callout is the kind of literal string users grep / Google for when their install fails. Removing it removes a SEO hook for the exact PR #19 failure mode.
- **[P2] [SINGLE-SOURCE: judge] No reviewer asked "what test or lint would have caught this proposal?"** The release-check.sh coupling is one-way (script greps README); it should be two-way (README has an HTML comment marker the script asserts presence of).

## Action Items

1. **[P1] [VERIFIED] [PLAN_RISK]** Reject the current proposal. Do not ship the three specified deletions.

2. **[P1] [VERIFIED]** Add a two-way invariant between `README.md` and `scripts/release-check.sh:80`. Insert a stable HTML-comment marker around the `@<marketplace-name>` callout (e.g., `<!-- release-check:marketplace-name-callout -->`). Have release-check assert the marker's presence in addition to its current value-match check. Prevents recurrence of "delete the thing the lint greps for."

3. **[P2] [VERIFIED]** Re-author the restructure proposal to:
   - (a) cite `CHANGELOG.md:171` and `HOW_WE_BUILT_THIS.md:726` in a "Prior decisions" section
   - (b) recompute the line-savings arithmetic honestly (~20 not ~50)
   - (c) target the tagline ↔ Requires-Claude-Code subsection duplication first (CE's surfaced gap)
   - (d) tighten Quick Start prose without deleting the three preserved items

4. **[P2] [SINGLE-SOURCE: judge]** Document a "doc-decision-reversal checklist" in `docs/` or `MEMORY.md`: before any README restructure proposal, grep CHANGELOG and HOW_WE_BUILT_THIS for the affected sections; cite findings in the proposal's Risks. The `doc-freshness-reverse-lint` skill referenced in MEMORY.md is the right shape of countermeasure.

5. **[P3] [CONSENSUS]** If, after action items 2-3, Quick Start is still >100 lines, revisit CE's "merge Quick Start + Installation marketplace section" alternative as a separate proposal. Not now.

## Meta-Observation

Two distinct concerns surfaced:

**About the project:** documentation decisions are accumulating in CHANGELOG.md and HOW_WE_BUILT_THIS.md but not surfacing into the authoring loop for new proposals. PR #20's deliberate "Kept" list was inverted 8 days later by an author (note: this was Claude itself in the prior turn) who did not engage with the prior reasoning. The `doc-freshness-reverse-lint` skill referenced in MEMORY.md is the right shape of countermeasure.

**About the panel's own performance:** the four reviewers collectively missed the strongest finding in the entire review — that a CI script literally greps for the string the proposal deletes. Phase 8 audit caught it. This argues for keeping the audit phase as a non-optional checkpoint, especially when a proposal touches files referenced by tooling. TA's score *increase* during a debate that surfaced two strong against-evidence findings was flagged by the judge as rhetoric-leaning. CC and DA's combined skepticism — often the underweighted voices in panels — was the correctly-calibrated position here.

## Detailed Reviews

See `review_panel_process.md` for the full director's-cut log of every reviewer, audit, and judge output verbatim.
