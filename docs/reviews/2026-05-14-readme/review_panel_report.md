# Review Panel Report

**Work reviewed:** `README.md` (671 lines)  |  **Date:** 2026-05-14
**Panel:** 4 reviewers + Completeness Audit + Supreme Judge
**Verdict:** REVISE — substantial edit needed  |  **Confidence:** Medium-High
**Auto-detected signals:** None — documentation base set used
**Review mode:** Exhaustive (auto-detected: pure documentation)
**Data flow trace:** Skipped (pure documentation — no code data transforms)

## Executive Summary

The README is factually careful where it counts — install commands, marketplace
handles, slash commands, the "401 tests" claim, and spot-checked anchors all
verify cleanly against the repo — and it is exhaustively thorough. But three
problems pull the score to **5/10**: (1) the version/release story is incoherent
and actively misleads every current user, (2) the document is roughly a third too
long and consistently serves the maintainer and changelog over the newcomer, and
(3) it never shows what a review actually produces. None of the defects are hard
to fix; their volume is the problem. All four reviewers independently anchored on
the version/release issue — score spread was only 2.0, and all four reviewers run
on the same base model, so treat the convergence with mild caution.

## Scope & Limitations

Reviewed: the text of `README.md`, cross-checked against `SKILL.md`, `CHANGELOG.md`,
`package.json`, `.claude-plugin/*.json`, `docs/research-foundations.md`, and git
tags. Not evaluated: the rendered GitHub appearance, image/GIF contents, or whether
the documented product behaviour is itself correct. Structural limitation: all four
reviewers are Claude instances — shared model bias is possible.

Epistemic labels used: `[VERIFIED]` (confirmed against source), `[CONSENSUS]`
(3+ reviewers independently), `[SINGLE-SOURCE]` (one reviewer, unrefuted),
`[DISPUTED]` (reviewers split).

## Score Summary

| Reviewer | Persona | Intensity | Score | Recommendation |
|---|---|---|---|---|
| Clarity Editor | Communicates clearly to its audience? | 60% | 5.5/10 | Cut ~⅓; split reader vs. maintainer content |
| Technical Accuracy | Every claim correct vs. the repo? | 30% | 4/10 | Fix phase table, release story, label glossary |
| Completeness Checker | What's missing the reader needs? | 40% | 6/10 | Operationally exhaustive but evaluator-hostile |
| Devil's Advocate | Does it persuade or mislead? | 20% | 4.5/10 | Documents unreleased versions; vanity metrics |
| **Judge** | **Final** | — | **5/10** | **REVISE before relying on it for onboarding** |

## Consensus Points (judge-confirmed)

- **Version/release story is broken** — all four reviewers, independently. `package.json`
  and both manifests declare `3.3.0`; the only git tags that exist are `v2.10.0,
  v2.16.5, v3.0.0, v3.1.0`. The "Updating" section tells users to verify their
  install against "the latest GitHub release" — which resolves to `v3.1.0`, so every
  correctly-installed v3.3.0 user concludes their install is wrong. The release badge
  renders `v3.1.0` while the prose says v3.3; hero images are pinned to the `v3.1.0`
  tag. `[VERIFIED][CONSENSUS]`
- **Too long, wrong audience** — the README mixes user docs, contributor docs, and
  design-history/author-archaeology in 671 lines; inline `(v2.16.3)`-style version
  attributions read as changelog bookkeeping, not user documentation. `[CONSENSUS]`
- **Migration / stale-state cleanup is bloated and duplicated** — the same "remove old
  marketplace name, delete orphan dirs, remove loose clones, reinstall" procedure
  appears in 4–5 non-identical places (~30% of the file is migration/troubleshooting).
  `[CONSENSUS]`

## Disagreement Points (with judge rulings)

- **Devil's Advocate rated the version/release issue P0; judge dampened to P1.**
  Reasoning: the README can be made fully correct without a release-process change
  (re-point the verify step, fix the badge, re-pin images). The untagged-release gap
  itself is a repo-process issue outside README scope. Still ranked the #1 action item.
- **"Credibility theater" / "vanity metrics" / "one model talking to itself" (DA).**
  Partially upheld. The README *does* disclose the shared-base-model limitation, so it
  is not dishonest — but the disclosure is buried at line 381 while the top of the doc
  sells "independent reviewers." Ruling: P2 — move the limitation up, soften
  "independent." The only hard factual defect in the research claims is the
  "peer-reviewed" qualifier (AutoGen has no venue). The 9-paper count is accurate.
- **Grandiose-naming finding (DA F10)** — reviewer self-identified as weakest;
  downgraded to P3. **Output-files-explained-3× (Clarity F15)** — reviewer
  self-identified as weakest; merged into the duplication finding, not carried separately.

## Completeness Audit Findings

- `docs/archive/review_panel_report.md` is a real, full sample report (6,920 bytes)
  that exists in-repo and is **never linked** — the README shows output only as GIFs.
  `[VERIFIED]`
- The "How It Works" table is two releases stale: SKILL.md defines **Phase 13.5**
  (Pre-Judge Verification Gate, v3.1.0) and **Phase 14.5** (Post-Judge Verification
  Gate, v3.2.0); neither appears in the README's headline table. `[VERIFIED]`
- The epistemic-labels glossary omits `[JUDGE-HALLUCINATED]` and `[COMPRESSED]`, both
  real shipped labels. `[VERIFIED]`
- A prior README restructure attempt is archived at
  `docs/archive/2026-04-27-readme-restructure-rejected/` — read why it was rejected
  before attempting another.

## Action Items (severity + epistemic labels)

| # | Severity | Action |
|---|---|---|
| 1 | **P1** `[VERIFIED][CONSENSUS]` | Fix the version/release story: tag `v3.2.0`/`v3.3.0`, **or** re-point the "Updating" verify step at `package.json`/`CHANGELOG.md` (not GitHub releases) + note releases may lag `main`; bump the `(e.g. 3.1.0)` example to `3.3.0`; re-pin the three hero-image URLs to a current tag or `main`. |
| 2 | **P1** `[VERIFIED]` | Add Phase 13.5 and Phase 14.5 rows to the "How It Works" table; reconcile the "sequential integers 1–16" prose. |
| 3 | **P1** `[CONSENSUS]` | Cut ~⅓ of the length and split audiences — move migration/stale-state/deep troubleshooting to `MIGRATION.md` + `TROUBLESHOOTING.md`; move design-history to `HOW_WE_BUILT_THIS.md`. Target ~250–350 lines. |
| 4 | **P1** `[VERIFIED]` | Add a text sample of a real report (Action Items table + one judged disagreement) in a `<details>` block; link `docs/archive/review_panel_report.md`. |
| 5 | **P2** `[CONSENSUS]` | Strip inline `(vX.Y)` attributions from reader-facing prose; describe features in present tense. |
| 6 | **P2** `[SINGLE-SOURCE]` | Slim the opening: H1, one-sentence tagline, one hero image, one "Claude Code only" note, then Quick Start. |
| 7 | **P2** `[SINGLE-SOURCE]` | Surface "When to use / When NOT to use" near the top (from SKILL.md); add a one-line cost-and-fit statement under the hero. |
| 8 | **P2** `[VERIFIED]` | Change "9 peer-reviewed papers" → "9 research papers/projects"; separate architecture-mapped papers from inspirational ones. |
| 9 | **P2** `[VERIFIED]` | Add `[JUDGE-HALLUCINATED]` and `[COMPRESSED]` to the epistemic-labels glossary; sync the Quick Start mini-list with the full table. |
| 10 | **P2** `[SINGLE-SOURCE]` | Add a "Support" section; expand "Contributing" with a real dev on-ramp. |
| 11 | **P2** `[SINGLE-SOURCE]` | Move the "same base model" limitation up into "Why Use a Panel"; reframe "independent reviewers" as "structured multi-stance self-critique." |
| 12 | **P2** `[SINGLE-SOURCE]` | Consolidate Prerequisites into one place (incl. Node ≥18, currently only in a troubleshooting footnote). |
| 13 | **P3** `[SINGLE-SOURCE]` | Move the Vocabulary glossary up; add a "finding looks wrong" troubleshooting entry; note outputs aren't renameable; define or drop "Schliff optimization (75 → 86)"; reconcile "Runs only on Claude Code surfaces" vs. the Agent SDK being supported. |

## Detailed Reviews

Full verbatim reviewer output, the judge ruling, and verification notes are in the
companion process log: `review_panel_process.md`. Per-reviewer state files are under
`state/`.
