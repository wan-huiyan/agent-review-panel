# Technical Accuracy Review — README.md (Phase 3, Independent)

**Reviewer:** Technical Accuracy Reviewer (skepticism 30%)
**Target:** `/home/user/agent-review-panel/README.md` (671 lines)
**Date:** 2026-05-14
**Method:** Claim-by-claim checklist verification against repo files.

## Score: 4/10

The README is well-organized and most *commands* (install handles, marketplace name, slash commands, npm scripts) check out exactly. But the document is materially stale against the actual v3.3.0 state of the repo: the "How It Works" 16-phase table predates Phase 13.5 AND Phase 14.5 (both real, both in SKILL.md), the version story is incoherent because no v3.2.0/v3.3.0 release tag exists yet the README tells users their cache version "should match the latest GitHub release", hero images are pinned to a stale `v3.1.0` tag, and several count claims are off. These are the exact class of bugs (procedural/factual drift that misleads a user) that sink a technical-accuracy score.

---

## Findings

### P1-1 — "How It Works" phase table is stale: missing Phase 13.5 AND Phase 14.5
**Location:** README lines 249–270 (the `## How It Works` table), also line 27 ("the 16-phase pipeline") and line 251.
**Claim:** "16 top-level phases ... numbered as sequential integers (Phase 1 through Phase 16)." The table lists phases 1–16 with no 13.5 or 14.5.
**Contradicting evidence:** `skills/agent-review-panel/SKILL.md` Process Overview (lines 117 and 1110) defines **Phase 14.5: Post-Judge Verification** ("Re-verify judge-introduced P0/P1 against ground truth (v3.2.0)"), and SKILL.md line 1027 defines **Phase 13.5: Pre-Judge Verification Gate (v3.1.0)**. CHANGELOG `[3.2.0]` ("Added — Phase 14.5") and `[3.1.0]` ("Phase 13.5 — Pre-Judge Verification Gate (NEW)") both confirm these are real, shipped phases. The README table reflects neither.
**Why it matters:** A user reading "How It Works" gets a process model that is two releases out of date and silently omits two verification gates that are core selling points of v3.1/v3.2. The README even cross-links this table from the Tests section (line 420) as authoritative.
**Fix:** Add two rows to the table: Phase 13.5 (Pre-Judge Verification Gate, v3.1.0) under **Verify**, and Phase 14.5 (Post-Judge Verification Gate, v3.2.0) under **Adjudicate**. Update line 251's "Phase 1 through Phase 16 ... sequential integers" prose to acknowledge the 13.5/14.5 decimals, the way it already acknowledges the 15.x sub-steps.

### P1-2 — Version story is incoherent: badge + "matches latest GitHub release" mislead a v3.3.0 user
**Location:** README line 1 (`[![GitHub release]]` badge), lines 148–152 ("Verify the update worked" → "It should match the [latest GitHub release]").
**Claim:** The dynamic release badge and the update-verification text tell the user the installed cache-dir version "should match the latest GitHub release."
**Contradicting evidence:** `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` all declare `3.3.0`. Known fact (confirmed: `git tag` returns nothing locally; remote tags are only v2.10.0, v2.16.5, v3.0.0, v3.1.0). There is no v3.2.0 or v3.3.0 release. So a correctly-installed v3.3.0 user runs `ls ~/.claude/plugins/cache/.../` sees `3.3.0`, compares to "latest GitHub release" (v3.1.0), and concludes their install is *ahead/broken* — or that they failed to update.
**Why it matters:** The single most actionable instruction in the Updating section produces a false negative for every current user. The badge will also render `v3.1.0` while the repo is `v3.3.0`.
**Fix:** Either cut releases v3.2.0 and v3.3.0 (preferred), or change the verify text to "should match the version in `package.json` / `.claude-plugin/plugin.json`" and note that GitHub releases may lag `main`. Line 154's example version "(e.g. `3.1.0`)" should be bumped to `3.3.0`.

### P1-3 — Hero/demo images pinned to stale `v3.1.0` tag
**Location:** README lines 15, 17, 19 — all three image URLs are `https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/v3.1.0/docs/...`.
**Claim:** Images served from the `v3.1.0` git tag.
**Contradicting evidence:** Repo is at v3.3.0 (`package.json` line 3). The image source files exist in the repo at HEAD (`docs/hero-flow.svg`, `docs/demo.gif`, `docs/html-demo.gif` all present — verified via `ls`). Pinning to `v3.1.0` means any visual change made in v3.2.0/v3.3.0 (e.g. the Chart.js wrapper-div fix, Live-State labels in the dashboard) is not reflected, and the pin is two releases stale.
**Why it matters:** Lower severity than P1-1/P1-2 (images still load), but it is a verifiable inconsistency and the `v3.1.0` tag is the same stale-version symptom as the badge.
**Fix:** Re-pin to `v3.3.0` once that tag exists, or use `main` / a permalink commit SHA.

### P2-4 — "9 research papers" — verifiable but internally inconsistent venue data
**Location:** README line 3 (badge "9 papers"), line 9, line 390, line 397.
**Claim:** "9 peer-reviewed papers."
**Contradicting evidence:** `docs/research-foundations.md` table does list exactly 9 rows — count is **correct**. BUT the README says "9 **peer-reviewed** papers" (line 390) while `research-foundations.md` lists **AutoGen** with venue "—" (no venue) — AutoGen is a GitHub project / tech report, not peer-reviewed. Also README line 392 calls ChatEval "ICLR 2024" and line 393 "MachineSoM (ACL 2024)" — these match. But README line 11/9 say papers are "on multi-agent debate"; `research-foundations.md` line 13 describes "Talk Isn't Always Cheap" only as "Failure mode analysis" — minor. Core count (9) is accurate; the "peer-reviewed" qualifier is the inaccuracy.
**Why it matters:** Small, but a skeptical reader who clicks through finds AutoGen has no venue, contradicting "peer-reviewed."
**Fix:** Change "9 peer-reviewed papers" to "9 research papers/projects" or footnote AutoGen as a non-peer-reviewed reference. (Note also ROADMAP.md line 212 says "Academic Papers (17+)" — a different scope, not a contradiction, but worth a glance.)

### P2-5 — "10 signal groups" list is slightly mislabeled vs. the actual checklist file
**Location:** README line 276: "10 signal groups (SQL, ML, Terraform, Auth, API, Frontend, Cost, Pipeline, Portability, Repo Hygiene)".
**Contradicting evidence:** `skills/agent-review-panel/references/signals-and-checklists.md` "## Domain Checklists" lists exactly 10 domain checklists: SQL/Data, Auth/Security, Infrastructure, ML/Statistics, API/Integration, Frontend/UI, Cost/Billing, Data Pipeline/ETL, **Repo/Data Hygiene**, Skill/Docs Portability. The count (10) is **correct**, but the README labels one "Terraform" — the actual group is "Infrastructure" (Terraform is one signal within it), and "Repo Hygiene" is actually "Repo/Data Hygiene". Minor naming drift.
**Why it matters:** Low — count is right; only two labels are imprecise.
**Fix:** Change "Terraform" → "Infrastructure" and "Repo Hygiene" → "Repo/Data Hygiene" to match the source file headings.

### P2-6 — VoltAgent "10 signal groups" vs "10 families" conflation risk
**Location:** README line 317 ("127+ specialist agents"), line 644 ("127+ agents, 10 families"), line 276 ("10 signal groups").
**Contradicting evidence:** `SKILL.md` line 327: "VoltAgent specialist agents (127+ across 10 **families**)". `plan-review-integrator/SKILL.md` line 77 same. So "127+" and "10 families" are **accurate**. The README correctly uses "families" on line 644. No contradiction found — but flag: README has both "10 signal groups" and "10 families" as distinct 10-counts; a reader could conflate them. Verified they are genuinely different concepts, both legitimately 10.
**Why it matters:** Not an inaccuracy — verified correct. Documented here only so the panel knows it was checked.
**Fix:** None required. Optionally disambiguate in prose.

### P3-7 — "401 tests" — accurate, confirmed by running the suite
**Location:** README lines 407, 409 ("run all 401 tests"), 420.
**Contradicting evidence / verification:** Ran `npm test`: output `# tests 401 / # pass 401 / # fail 0`. `package.json` `test` script runs the six `tests/*.test.mjs` files. The six `npm run test:*` sub-scripts (triggers, manifest, eval-suite, report, behavioral, golden) **all exist** in `package.json` lines 8–13 and match the README list at lines 411–417 exactly. `scripts/release-check.sh` line 110–118 also greps README for `N tests` and asserts it equals actual.
**Why it matters:** This claim is **correct** — noted as a positive. (CHANGELOG shows the historical drift: 379→386 in v3.2.0; current is 401, README matches.)
**Fix:** None. Accurate.

### P3-8 — Commands & install handles — accurate, confirmed
**Location:** README lines 40–41, 54–55, 124, 134–136, 173–177, 431–434, 611–615.
**Verification:** `.claude-plugin/marketplace.json` line 3: marketplace `name: "agent-review-panel"`; line 10: plugin `name: "roundtable"`; `source: "./"`. So `roundtable@agent-review-panel` (README) is **correct**. Slash commands `/roundtable:agent-review-panel` and `/roundtable:plan-review-integrator` match the skill dir names (`skills/agent-review-panel/`, `skills/plan-review-integrator/`) and SKILL.md frontmatter `name:` fields. The README marketplace-name callout (lines 123–125) is accurate.
**Why it matters:** Correct — noted as positive.
**Fix:** None.

### P2-9 — Stale slash-command form inside SKILL.md frontmatter (cross-ref inconsistency)
**Location:** README line 88 / line 46 reference `/roundtable:agent-review-panel`; README repeatedly states the namespaced form.
**Contradicting evidence:** `skills/agent-review-panel/SKILL.md` line 10 frontmatter description still says "or invokes **/agent-review-panel**" (un-namespaced) — and `plan-review-integrator/SKILL.md` line 18 says "invokes **/plan-review-integrator**". The README's `/roundtable:<skill>` claim is the correct one per the plugin model; the SKILL.md files are the stale party. This is technically a SKILL.md bug, but it means the README's own cited authority disagrees with it.
**Why it matters:** A reader cross-checking SKILL.md sees a different command. The README is right; the skill files need fixing — but the README could note the namespacing explicitly survives this.
**Fix:** Out of README scope to fix SKILL.md, but flag it. The README is accurate here.

### P2-10 — "new in v2.15" expandable cards — accurate but README double-states the introduction version inconsistently
**Location:** README line 93 ("new in v2.15"), line 21 & 301 (10-section cards described), line 638 (Version History "v2.15").
**Verification:** CHANGELOG `[2.15.0]` confirms "Expandable 10-section issue cards." SKILL.md line 1227 lists the 10 sections; the README's 10-section list (lines 302–312) — Narrative, Code Evidence, Raised by, Verification Trail, Debate, Judge Ruling, Fix Recommendation, Cross-references, Epistemic Tags, Prior Runs — matches CHANGELOG `[2.15.0]` exactly. **Accurate.**
**Why it matters:** Correct — noted positive.
**Fix:** None.

### P2-11 — Epistemic-labels list: README "Reading the Report" table omits `[JUDGE-HALLUCINATED]` and `[COMPRESSED]`
**Location:** README lines 578–591 (the "Epistemic labels" table in "Reading the Report").
**Claim:** The table enumerates the epistemic labels a finding can carry.
**Contradicting evidence:** `SKILL.md` line 1227 — the canonical Phase 15.1 label list — is: `[VERIFIED] [CONSENSUS] [SINGLE-SOURCE] [UNVERIFIED] [DISPUTED] [WEB-VERIFIED] [WEB-CONTRADICTED] [WEB-INCONCLUSIVE] [JUDGE-HALLUCINATED] [LIVE-VERIFIED] [STATIC-INFERENCE] [STATIC-INFERENCE-CONSENSUS]`. The README table includes VERIFIED, CONSENSUS, SINGLE-SOURCE, DISPUTED, UNVERIFIED, WEB-*, CMD_CONFIRMED/CONTRADICTED, LIVE-VERIFIED, STATIC-INFERENCE, STATIC-INFERENCE-CONSENSUS — but **omits `[JUDGE-HALLUCINATED]`** (a real v3.2.0 label, SKILL.md line 1136/1227) and **omits `[COMPRESSED]`** (real v3.1.0 suffix, SKILL.md lines 1198–1200). Note also: README line 299 (the Quick Start mini-list of labels) DOES omit JUDGE-HALLUCINATED too, and includes the same set — internally consistent with itself but both lists are incomplete vs SKILL.md.
**Why it matters:** A user who sees `[JUDGE-HALLUCINATED]` on an action item (the headline feature of v3.2.0) finds no entry for it in the README's label glossary.
**Fix:** Add `[JUDGE-HALLUCINATED]` and `[COMPRESSED]` rows to the "Epistemic labels" table (lines 578–591), and add `[JUDGE-HALLUCINATED]` to the Quick Start list on line 299.

### P2-12 — README line 299 / line 93 attribute `[CMD_CONFIRMED]` etc. inconsistently and the line-299 list contradicts the line-588 table
**Location:** README line 299 (Quick Start label list) vs lines 578–591 (table).
**Contradicting evidence:** Line 299's parenthetical list and the lines 578–591 table differ in membership: the table has a `[CMD_CONFIRMED] / [CMD_CONTRADICTED]` row (line 588) that line 299 does **not** list; line 299 lists `[STATIC-INFERENCE-CONSENSUS]` which the table also has. Two label enumerations in the same document with different contents.
**Why it matters:** Internal inconsistency; a reader can't tell which list is authoritative.
**Fix:** Make line 299 and the lines 578–591 table list the same set, both synced to SKILL.md line 1227.

### P3-13 — "Phase 15 is a parent step with three sub-steps" — accurate
**Location:** README line 251, lines 269, 420.
**Verification:** SKILL.md lines 118–122 confirm Phase 15 parent with 15.1/15.2/15.3 sequential. SKILL.md line 1172 "in strict sequence: Phase 15.1 first, then 15.2, then 15.3." README's "written sequentially per the v2.16.4 disk-reading architecture" matches CHANGELOG `[2.16.4]`. **Accurate.**
**Fix:** None.

### P2-14 — "Migration" section uninstall commands reference marketplace names that may never have shipped as written
**Location:** README lines 451–458.
**Claim:** `claude plugin uninstall agent-review-panel@wan-huiyan-agent-review-panel` and `...@wan-huiyan-plan-review-integrator`.
**Contradicting evidence:** CHANGELOG `[2.16.1]` says the marketplace was renamed `wan-huiyan-agent-review-panel` → **`plugin`** (not to a `wan-huiyan-plan-review-integrator` marketplace). CHANGELOG `[2.16.0]` confirms `agent-review-panel` → `wan-huiyan-agent-review-panel`. There is no CHANGELOG evidence a marketplace named `wan-huiyan-plan-review-integrator` ever existed — plan-review-integrator was a separate *repo* (`wan-huiyan/plan-review-integrator`, now archived per README line 443), not a marketplace by that name. The uninstall line for it may be uninstalling a handle that never existed.
**Why it matters:** Could confuse users who never had that install; harmless if the command no-ops, but it's an unverifiable claim presented as fact.
**Fix:** Verify against actual historical marketplace.json revisions; if `wan-huiyan-plan-review-integrator` was never a marketplace, drop that line or relabel it as the standalone-repo case.

### P3-15 — Anchor links spot-check — all pass
**Location:** README Contents (lines 25–32) and inline `#anchor` links.
**Verification:** `#research-foundations` → `## Research Foundations` heading (line 388) ✓ and explicit usage matches. `#requires-claude-code` → `### Requires Claude Code` (line 99) ✓. `#bundled-skills` → `## Bundled skills` (line 425) ✓. `#quick-start` → explicit `<a id="quick-start">` (line 34) ✓. `#updating-to-the-latest-version` → `### Updating to the latest version` (line 129) ✓. `#manual-clone-development--custom-setup` → explicit `<a id>` (line 191) ✓. `#after-install-roundtableagent-review-panel-is-not-recognized` → explicit `<a id>` (line 514) ✓. **All anchors verified present.**
**Fix:** None.

---

## Top 3 Most Defensible Findings
1. **P1-1 (stale phase table)** — Directly contradicted by SKILL.md lines 1027 & 1110 and CHANGELOG [3.1.0]/[3.2.0]. Two whole phases missing from the headline "How It Works" table. Unambiguous.
2. **P1-2 (version story incoherence)** — Three manifest files say 3.3.0; no v3.2.0/v3.3.0 tag exists; the README's verify-instruction produces a guaranteed false negative for every current user.
3. **P2-11 (epistemic labels table incomplete)** — SKILL.md line 1227 is the canonical list; README's table provably omits `[JUDGE-HALLUCINATED]` and `[COMPRESSED]`, both real shipped labels.

## Top 3 Least Defensible Findings
1. **P2-6 (VoltAgent 10/10 conflation)** — On inspection, no actual inaccuracy; both counts are correct. Included only as a "checked, clean" note; not a real defect.
2. **P3-15 (anchors)** — All passed; this is a non-finding, listed for completeness of the checklist.
3. **P2-14 (migration marketplace name)** — I could not find a marketplace.json revision history to fully confirm `wan-huiyan-plan-review-integrator` never existed; this is a "suspicious, unverified" flag rather than a proven inaccuracy. Stated as such.

## Verdict
README is structurally solid and its commands/counts mostly verify, but it is two releases stale on the phase model and the version-tracking guidance actively misleads every v3.3.0 user — fix the phase table, the release story, and the epistemic-label glossary before shipping.
