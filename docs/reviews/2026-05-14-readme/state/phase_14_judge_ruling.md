# Phase 14 — Supreme Judge Ruling

**Work reviewed:** `README.md` (671 lines)
**Panel:** Clarity Editor, Technical Accuracy Reviewer, Completeness Checker, Devil's Advocate + Completeness Audit + Verification
**Review mode:** Exhaustive (pure documentation)
**Date:** 2026-05-14

## Step 0 — Verification review

Independently confirmed against the repo:

- **Remote git tags:** only `v2.10.0, v2.16.5, v3.0.0, v3.1.0` exist. No `v3.2.0`/`v3.3.0`. `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` all declare `3.3.0`. → version/release finding **[VERIFIED]**.
- **SKILL.md** Process Overview includes `Phase 13.5` (v3.1.0) and `Phase 14.5` (v3.2.0); README "How It Works" table lists only integer phases 1–16. → stale-table finding **[VERIFIED]**.
- **`docs/archive/review_panel_report.md`** exists (6,920 bytes) and is never linked from the README. → "no text sample" finding **[VERIFIED]**.
- **`docs/research-foundations.md`** has exactly 9 paper rows (count correct) but lists **AutoGen** with venue `—`. → "9 peer-reviewed papers" qualifier **[VERIFIED] inaccurate**; "9 papers" count **accurate**.
- **`.github/workflows/test.yml`** exists; `npm test` → 401/401 pass. → Tests badge + "401 tests" **accurate**.
- Inline `(vX.Y)` version attributions appear throughout reader-facing prose (10+ confirmed instances). → **[VERIFIED]**.
- Install handles, marketplace name, slash commands, all six `npm run test:*` scripts, and spot-checked anchors → **accurate**.

## Step 0.5 — Severity dampening

- Devil's Advocate rated the version/release finding **P0**. Dampened to **P1**: the README itself can be made fully correct without a release-process change (point the verify step at `package.json`/`CHANGELOG`, fix the badge, re-pin images). The underlying untagged-release gap is a repo-process issue outside README scope. Still ranked **#1 priority**.
- Devil's Advocate F10 (grandiose naming) — self-identified as weakest; reduced to **P3**. F3/F5 (credibility theater / vanity metrics) retain a verified factual core ("peer-reviewed" overclaim) at **P2**; the framing critique is advisory **[SINGLE-SOURCE]**.
- Clarity F15 (output files explained 3×) — reviewer self-identified as least defensible; merged into F2/F5 duplication finding, not carried as a separate item.

## Step 1–3 — Consensus and disagreement

**Strong consensus (3–4 reviewers, independently):**
1. Version/release story is incoherent and actively misleads current users — *all four reviewers*.
2. README is too long and serves the maintainer/changelog over the newcomer — Clarity (whole review), DA F7/F9, Completeness (lopsided).
3. Inline `(vX.Y)` version-attribution noise in reader-facing prose — Clarity F3, DA F7.
4. Migration / stale-state cleanup content is bloated and duplicated across 4–5 locations — Clarity F5, DA F6.

**Single-source but verified (no reviewer refuted):**
- Stale "How It Works" phase table — Technical P1-1.
- No text sample of a real report; a real one sits unlinked in `docs/archive/` — Completeness P1-1.
- Epistemic-labels glossary omits `[JUDGE-HALLUCINATED]`/`[COMPRESSED]` — Technical P2-11.
- "When NOT to use" buried in SKILL.md — Completeness P1-3.
- No support channel; thin Contributing — Completeness P1-4/P1-5.

**Disputed / judgment (judge ruling):** DA's "credibility theater" and "one model talking to itself" framing — *partially upheld*. The README **does** disclose the shared-base-model limitation (Known Limitations), so it is not dishonest; but the disclosure is buried at line 381 while the top of the doc leans on "independent reviewers." Ruling: valid **P2** — move the limitation up and soften "independent" to "structured multi-stance self-critique." The research-grounding is legitimate to cite; the only hard defect is the "peer-reviewed" qualifier.

## Step 4–5 — Score

Reviewer scores: 5.5 / 4 / 6 / 4.5 → mean **5.0/10**. Spread 2.0 (moderate convergence — the version/release problem anchored every reviewer). No correlated-bias override needed, but noted: all four are the same base model.

## Step 6–7 — Final verdict

**Verdict: REVISE — substantial edit needed before this serves as the primary onboarding doc. Score 5/10. Confidence: Medium-High.**

The README is factually careful where it counts (commands, counts, anchors all verify) and exhaustively thorough — but it is two releases stale on its central version story, roughly a third too long, and consistently prioritises maintainer/changelog content over the newcomer's path to first run. None of the defects are hard to fix; the volume of them is the problem.

## Step 8 — Action items (severity + epistemic labels)

1. **[P1][VERIFIED][CONSENSUS]** Fix the version/release story. Either tag `v3.2.0`/`v3.3.0`, or: change the "Updating" verify step to compare against `package.json`/`CHANGELOG.md` (not GitHub releases) and note releases may lag `main`; bump the `(e.g. 3.1.0)` example to `3.3.0`; re-pin the three hero-image URLs to a current tag or `main`. *Defect type: [EXISTING_DEFECT] — current instructions misfire for every v3.3.0 user.*
2. **[P1][VERIFIED][SINGLE-SOURCE]** Update the "How It Works" table — add Phase 13.5 (Pre-Judge Verification Gate) and Phase 14.5 (Post-Judge Verification Gate); reconcile the "sequential integers 1–16" prose.
3. **[P1][CONSENSUS]** Cut length ~⅓ and split audiences. Move migration / stale-state cleanup / deep troubleshooting to `MIGRATION.md` + `TROUBLESHOOTING.md` (or collapse to one canonical recipe with cross-links); move design-history/author-archaeology to `HOW_WE_BUILT_THIS.md`. Target ~250–350 lines for the README.
4. **[P1][VERIFIED]** Add a text sample of a real report — lift ~15 lines (Action Items table + one judged disagreement) from `docs/archive/review_panel_report.md` into a `<details>` block, and link that file.
5. **[P2][CONSENSUS]** Strip inline `(vX.Y)` attributions from How It Works / Features / Quick Start / Bundled skills. Describe features in present tense; leave history to the Version History table + CHANGELOG.
6. **[P2][SINGLE-SOURCE]** Slim the opening — H1, one-sentence tagline, one hero image, one "Claude Code only" note, then Quick Start. Move the bundled-skills blockquote and surfaces detail into their existing sections.
7. **[P2][SINGLE-SOURCE]** Surface "When to use / When NOT to use" near the top (source it from SKILL.md's list) and add a one-line cost-and-fit statement under the hero ("~$3–$20 per run, 6–15 min; for high-stakes reviews, not routine checks").
8. **[P2][VERIFIED]** Fix "9 peer-reviewed papers" → "9 research papers/projects" (AutoGen has no venue); in Research Foundations, separate "mechanisms mapped to architecture" from "papers that informed thinking."
9. **[P2][VERIFIED]** Add `[JUDGE-HALLUCINATED]` and `[COMPRESSED]` to the epistemic-labels glossary; sync the Quick Start mini-list with the full table.
10. **[P2][SINGLE-SOURCE]** Add a "Support" section (GitHub Issues link + "include content type & size"); expand "Contributing" with a dev on-ramp (clone location, `npm test` + Node ≥18, where SKILL.md lives, `release-check.sh`).
11. **[P2][SINGLE-SOURCE]** Move the "same base model" limitation up into "Why Use a Panel"; reframe "independent reviewers" as "structured multi-stance self-critique" — keep it honest, it's still a real benefit.
12. **[P2][SINGLE-SOURCE]** Consolidate Prerequisites into one place (Claude Code v1.0+, supported surface, Pro/Max or API, Node ≥18 for tests/manual clone, OS). Node ≥18 currently only appears in a troubleshooting footnote.
13. **[P3][SINGLE-SOURCE]** Move the Vocabulary glossary up (or add an early pointer); add a Troubleshooting entry for "a finding looks wrong" tying to epistemic labels + `HUMAN REVIEW RECOMMENDED`; note output filenames/location are not configurable; define or drop "Schliff optimization (75 → 86)"; reconcile "Runs only on Claude Code surfaces" with the Agent SDK being listed as supported.

## Step 9 — Meta-observation

The README's weaknesses are a mirror of the project's strengths: the same completionist instinct that produced a 16-phase verification pipeline produced a README that documents every phase, every rename, and every version bump. The fix is not more writing — it is subtraction and audience discipline. Notably, a previous restructure attempt is archived at `docs/archive/2026-04-27-readme-restructure-rejected/`; whoever revises should read why that one was rejected before starting.
