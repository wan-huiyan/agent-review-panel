# Changelog

All notable changes to Agent Review Panel.

## [3.9.1] — 2026-08-11 — The debate-in-Workflow recipe taught a silently degraded run

The worked example at *Review-Mode Spectrum & Debate-in-Workflow* was presented as how to get the
panel's depth under the Workflow / ultracode engine. It was three stages — round 1 → peers-injected
round 2 → judge — and it silently omitted **Phases 4, 6, 7, 8, 9, 10, 11, 12, 13, 13.5, 14.5 and
15**. Worse, it advertised that authoring a `Debate` phase *"is what makes the round-1 state files
exist — which in turn satisfies the NO-DEBATE check"*, which taught the reader to satisfy the debate
detector while skipping every verification pass. In a skill whose stated principle is that degraded
rigor must be loudly bannered and never silently applied, the worked example produced a silently
degraded run.

**This is not hypothetical.** A panel run authored from that recipe on 2026-08-10 shipped two wrong
findings, each of an omitted phase's defect class:

| Wrong finding | Phase that catches it |
|---|---|
| A reviewer cited a changelog entry to the wrong Claude Code version | **Phase 10** — verifies citations against source |
| A reviewer filed a P0 claiming a foreground subagent's `SendMessage` to `"main"` is a silent no-op; it is not (the verbatim result is `{"success":true,"message":"Message queued for the main conversation's next turn."}`) | **Phase 11** — re-reads ground truth for every P0 and downgrades overstated ones; one read-only probe falsified this |

Both were caught by hand afterwards, not by the protocol.

**Fix — banner-first, plus one bought-back stage.** SKILL.md loads into orchestrator context on every
invocation, so expanding the recipe into a full 16-phase transcription would tax every run. Instead:

- **The recipe now declares itself a compressed run** and MUST stamp a `COMPRESSED RUN` banner whose
  phases-skipped list is fixed (the recipe's shape is fixed, so the list is not recomputed per run).
  Every action item carries `[COMPRESSED]`, per Phase 15.1. No new banner type was invented.
- **Five mandatory stages, not three.** Stage 3 is the *consolidated verifier* budget mode already
  specifies (Phases 8 + 10 + 11 in one agent, writing `state/phase_8_10_11_verification.md`) — one
  `agent()` call, and it is exactly what catches the two defects above. The judge stage may not
  restore a severity the verifier downgraded, nor accept a finding whose citation it could not
  confirm. Stage 5 is a terminal `Report` stage that *is* Phase 15.1.
- **The NO-DEBATE sentence is gone.** The recipe now states that authoring `Debate` satisfies the
  NO-DEBATE check **and nothing else**, and names the failure mode: passing the debate detector while
  skipping every verification pass.

**Phase 15.1's chokepoint has a documented hole.** Phase 15.1 is terminal for orchestrator-driven
runs, but a Workflow has no orchestrator walking the phase list — a script that ends at `Judge` never
executes Phase 15.1, so neither the NO-DEBATE nor the COMPRESSED check ever fires, however much the
run skipped. That cannot be closed by detection from inside the skill; it is now stated plainly in
Phase 15.1, with the authorial mitigation (the recipe's mandatory `Report` stage) and the rule that a
Workflow returning findings without a Phase 15.1 report stage has not run this panel and must not be
presented as one.

Also fixes a dangling cross-reference in the Phase 13.5 debate-presence assertion (*"see Debate
inside a Workflow below"* → the section is *Debate-in-Workflow recipe*).

Tests: 521 → 529 (8 new behavioral assertions; 7 verified failing against the pre-fix text). No
persona, scoring, or report-format changes.
## [3.9.0] — 2026-08-10 — Reviewer addressing contract + blocked-reviewer handling

Investigated adapting the panel to Claude Code's cross-session/peer messaging update (2.1.224). Most of what that surfaced was not new capability — two of the three changes here are defects the skill already had, which the update only made *detectable*.

- **Reviewer addressing contract.** v3.8.0 drove Phases 4/5/7 via `SendMessage` "to these same agents" but never said what string identifies them (`grep -rn agentId skills/` returned zero). Panel reviewers are spawned nameless, so the persona label and the Agent tool's `description` both fail to resolve — only the raw `agentId` from the spawn result works, as `SendMessage` has documented since **2.1.77**. The orchestrator now records a persona → agentId map (per-run in multi-run mode, held in context — no state file), addresses every send by that id, and treats `{"success": false}` as a failed agent under the existing retry-once rule. Since **2.1.224** a failed delivery reports an error instead of success, which is what makes this checkable at all. Correctness was never at risk, but not because of the fallback — while a failed send reported success the fallback could not fire. What actually protected the run was the state-directory polling (the orchestrator waits on the expected `state/` files, not on a reply) plus the Phase 13.5 gate, which turns a reviewer that never answered into a missing phase output. Still, *which* path a run took was unknowable, and an unannounced fallback is the wrong default in a skill built on announcing degradation.
- **Fresh-spawn fallback had no memory.** SKILL.md promises five times that a freshly spawned replacement reads its own prior `state/` files; `prompt-templates.md` never told it to. A replacement answered a debate prompt from an empty context and its output still passed the Phase 13.5 gate. One preamble line added to the Phase 4/5/7 templates.
- **A blocked reviewer no longer reads as a clean vote.** Phase 13.5 checks existence, ≥500 bytes and required headers — all of which a blind reviewer's well-formed "no findings" review passes, so the judge counted it as agreement. A reviewer that cannot reach the work now writes `state/reviewer_<slug>_BLOCKED.md` **instead of** its required phase file, making the file genuinely absent so the existing gate re-dispatches and then falls through to `COMPRESSED RUN`. No new gate logic, no fourth check, no new banner.

**Declined, with reasons recorded** in `docs/plans/2026-08-10-peer-messaging-adaptation-design.md` so they are not re-litigated: **agent teams** (the only route to a real peer-to-peer debate mesh) — teammates cannot spawn teammates and this panel is often invoked nested; teammates are full sessions while reviewer fan-out is only 7% of measured run cost; and a free-running mesh would disable the Phase 6 sycophancy detector, which needs a round barrier to count position changes before the next round is written. **Cross-session messaging** — messages carry plain text only and so cannot hand over a report; the receiver's `crossSessionInbound` policy can hold or refuse; unanswered approval dialogs drop after five minutes; macOS/Linux only.

**Verified by probe** (Claude Code 2.1.226, macOS): orchestrator → subagent by `agentId` works and by persona name fails; there is no sibling mesh; a subagent → `"main"` push works from foreground spawns too but is queued for the next turn, so it arrives no earlier than the return value (which is why the blocked-reviewer fix uses no messaging at all); foreground spawns do return an `agentId`, so no background-spawn mandate was needed.

Reviewed by a four-reviewer adversarial panel with debate and an Opus judge: SOUND WITH AMENDMENTS. That review run was itself compressed to 3 of 16 phases, so its verdict was held at Medium confidence and every load-bearing claim was re-verified by hand — which caught corrections across three claims in the design doc (a false claim that `ListAgents` does not exist; three wrong changelog version attributions; and a claim that a subagent's push to `"main"` makes blockage reportable the moment it happens, which is queued for the next turn and so arrives no earlier than the return value — that part was cut) and two errors in the review itself.

## [3.8.3] — 2026-08-05 — Vendored gate re-pinned at context-police v2.3.0

`scripts/check_skill_descriptions.py` re-vendored from `context-police@c413fd4`, which closes two
gaps in the gate's own guarantees:

- **Wrap corruption is now scored over every skill, disabled included, and fails the build.** It
  was scoped to the model-invocable subset, so a hyphen break inside a
  `disable-model-invocation: true` skill was neither printed nor failed. This repo has no disabled
  skills, so nothing changes here — but the check is now honest about what it covers.
- **New `NO HEADROOM` tier** (under 40 chars to spare), separate from `APPROACHING CAP`, which
  spanned everything above 1,152 chars in one undifferentiated bucket. This skill's description
  sits at **1,505 chars — 31 to spare**, so it lands in that tier. Under the cap, not failing, but
  one edit from truncating trigger text: worth a trim in a future release.

`--json` gains `min_headroom`, `counts.critical_headroom` and per-skill `critical`/`headroom`.
Cap arithmetic unchanged, so no figure in this changelog moves.

No protocol, persona, or output changes. Test suite 499/499.

## [3.8.2] — 2026-08-05 — Accuracy: the v3.8.1 coverage table did not reproduce

The v3.8.1 entry cited coverage figures with no command and no named harness. They came from an
uncommitted one-off and do not reproduce against `scripts/score_trigger_coverage.py`, which now
ships in this repo.

| metric | v3.8.1 claimed | committed harness |
|---|---|---|
| per-prompt | 13 better / 25 unchanged / 1 marginally lower | **12 better / 27 same / 0 worse** |
| positive mean coverage | 49.5% → 56.9% | **0.4950 → 0.5673** |
| separation | +26.0 → +32.0 pts | **+0.2605 → +0.3183** |
| negative mean coverage | not stated | 0.2345 → 0.2490 |

The direction and magnitude survive; the decimals and the per-prompt split did not, and the
"1 marginally lower" row does not exist. Both the v3.8.1 CHANGELOG bullet and the ROADMAP row are
corrected in place with an erratum rather than silently overwritten. Refs in the reproduce command
are pinned to commits, because `main` is now the post-trim state and `--old main:` prints a table
of zero deltas.

Also in this release:

- **`tests/golden/sample-report-budget-mode.golden.json` is now committed.** The fixture
  `sample-report-budget-mode.md` was tracked but its golden snapshot was not, so
  `tests/golden-file.test.mjs` took its `golden file missing` branch on every fresh clone — which
  writes the file and then `assert.ok(true)`. That fixture has never actually been guarded.
  Verified by negative control: with the snapshot committed, renaming a section heading in the
  fixture turns the suite red (495/499); before, the same edit was 499/499 green.
- **`scripts/check_skill_descriptions.py` re-vendored** from `context-police@eedad0f` (version
  2.2.1). Its `find_wrap_corruption()` no longer reports a bogus `BROKEN BY LINE-WRAP` on skills
  written `description: >-` (11 → 7 hits across `~/.claude/plugins/cache`; all four dropped are
  false positives). The cap arithmetic is unchanged from v2.2.0, so no char figure in this
  changelog moves.

No protocol, persona, or output changes. Test suite 499/499.

## [3.8.1] — 2026-08-04 — Trigger recovery: the frontmatter description was over the listing cap

**25 of the skill's 51 trigger phrases could not fire.** Claude Code caps each skill's listing entry at
`skillListingMaxDescChars` (default 1536) and truncates the overflow — it keeps `full[:1535]` and appends an
ellipsis, with no intelligence about sentence or phrase boundaries. The description had grown to **2,703
chars**, so everything from *"multi-run union mode"* onward was invisible to the model. Nothing warned: the
skill still listed, still ran when named, still passed every test.

Casualties (all documented in SKILL.md, none reachable):

| Mode | Triggers lost |
|---|---|
| **budget** | *all 11* — `"budget mode"`, `"budget review"`, `"budget panel"`, `"cheap review"`, `"economy review"`, `"low-cost panel"`, `"affordable review"`, `"token-efficient review"`, `"frugal review"`, `"lite panel"`, + the cost-constraint phrasings |
| **multi-run union** | `"multi-run review"`, `"run twice"`, `"run 3 times"`, `"run N times and merge"`, `"maximum coverage review"` |
| **data-flow trace tiers** | `"exhaustive review"`, `"trace everything"`, `"catch all bugs"` |

**How it happened** (reconstructed from git):

| Commit | Description | Status |
|---|---:|---|
| `b97db47` — schliff quality pass (75→86) | 1,501 | ok, 35 chars under the cap |
| `7464383` — v2.14 Data Flow Trace + Multi-Run Union | 2,004 | **cap breached** |
| `c385cee` — v3.7.0 budget mode | 2,326 | already invisible on arrival |
| `92f3ba3` — v3.7.1 *"broaden budget-mode triggers"* | 2,703 | every added trigger landed past the cut |

The irony is exact: **v3.7.1 existed solely to make budget mode more discoverable**, and every phrase it added
was born dead. The v2.14 breach is the root cause; the two releases after it were building on top of a cliff.

**Fixed:**

- Description rewritten to **1,505 chars** (listing entry 1,527 — 9 under the cap) with **zero** trigger
  phrases past the cut. Synonym runs are compressed rather than deleted (the model generalizes from
  `"cheap review"` to `"frugal review"`; it cannot generalize from a phrase it never sees), and the
  natural-language triggers, the NOT-for list, and every mode name are preserved.
- Measured against the eval suite's 39 positive prompts (word-overlap coverage vs. what the model *actually
  saw* before): **12 better, 27 unchanged, 0 worse**; mean coverage **0.4950 → 0.5673**, and
  positive-vs-negative separation **+0.2605 → +0.3183**, so precision against the 23 negative prompts held
  (negative mean 0.2345 → 0.2490). Reproduce:

  ```
  python3 scripts/score_trigger_coverage.py \
      --old  616fb54~1:skills/agent-review-panel/SKILL.md \
      --new  616fb54:skills/agent-review-panel/SKILL.md \
      --eval skills/agent-review-panel/eval-suite.json
  ```

  > **Corrected 2026-08-05.** This bullet originally read "13 better, 25 unchanged, 1 marginally
  > lower; mean coverage 49.5% → 56.9%, separation +26.0 → +32.0 pts", with no command and no
  > named harness. Those figures came from an uncommitted one-off and do not reproduce: the
  > committed `scripts/score_trigger_coverage.py` reports **12 / 27 / 0**, and in particular the
  > "1 marginally lower" row does not exist. The direction and magnitude survive; the decimals and
  > the per-prompt split did not. Refs are pinned to commits rather than `main`, because `main`
  > now *is* the post-trim state and `--old main:` would print a table of zero deltas.
- **`scripts/check_skill_descriptions.py`** (vendored from
  [context-police](https://github.com/wan-huiyan/context-police)) + **`tests/description-cap.test.mjs`** now
  gate this in CI, including an assertion that no quoted trigger phrase sits past the truncation point.
  Verified to fail on the shipped v3.8.0 description and pass on this one.

No protocol, persona, or output changes — this is purely the frontmatter description plus its CI gate.

> **Note on body-size linters:** `schliff score` measures SKILL.md *body* size, which lazy-loads only when the
> skill fires. The description is resident every turn and is a different budget entirely. Commit `b97db47`
> used schliff and landed at 1,501 chars; the very next feature commit blew past the cap and schliff never
> complained, because it does not measure descriptions. Run both checks.

## [3.8.0] — 2026-07-16 — Orchestrator Efficiency Discipline (turn diet by default, all modes)

Promotes the quality-free portion of budget mode's turn diet to a **default for every mode** — full panel, deep, multi-run, assessment, and budget alike. The measured cost driver ($162 audit: orchestrator main loop = 69%, reviewer fan-out = 7%) is orchestration overhead, and none of these rules removes a review, debate round, or verification pass:

- **New SKILL.md section `## Orchestrator Efficiency Discipline (v3.8.0 — all modes)`**: batched launches; **persistent reviewers** (spawn each persona once in Phase 3, drive Phases 4/5/7 via SendMessage to the same cached agent, fresh-spawn fallback reads prior state files); **≤50-word agent returns** (tightened from 100 words, SKILL.md + prompt-templates.md); no inter-phase narration (one line per transition); **≤40-turn full-panel target** (measured pre-discipline run: 157); fresh-session recommendation when the conversation already carries heavy context; orchestrator reads state files only for orchestrator-side logic (Phase 6 summarization, 12a dispute detection, judge ruling, 14.5/15.1 checks).
- **Phases 3/4/5/7 rewritten** to drive the same persistent reviewer agents via batched SendMessage instead of fresh parallel spawns per phase.
- **Budget mode's turn-diet section** now references the global discipline and keeps only its stricter deltas (≤25-turn target, strictest read rule).
- Implementation Notes bullet added.

Budget mode remains the explicit opt-in profile for the quality-*trading* cuts (3 sonnet reviewers, 1 debate round, consolidated verification, markdown-only output).

**Empirically verified** (2026-07-16, full protocol on a 206-line script, 4 opus reviewers, 3 adaptive debate rounds, HTML skipped): orchestrator **51 turns / $22 / 31% of run cost** vs the pre-discipline baseline's **157 turns / $111 / 69%** — the targeted driver collapsed while review quality held (0 hallucinated claims, 20/20 citations verified, a genuine P1 discovered, judge introduced 0 findings). The ≤40-turn target was missed by 11 turns, attributable to nested-verification harness effects (idle/nudge cycles before the poll-loop instruction landed). Measured trade to watch: persistent reviewers accumulate context across rounds — reviewer-side cost share rises when debate runs the full 3 rounds.

## [3.7.1] — 2026-07-16 — Budget mode discoverability (broader triggers + docs)

Makes budget mode easier to reach without weakening the explicit-opt-in guarantee:

- **New named trigger phrases** in the SKILL.md frontmatter: "budget panel", "affordable review", "token-efficient review", "frugal review", "lite panel" (joining "budget review", "budget mode", "cheap review", "economy review", "low-cost panel", and the `budget` arg).
- **Cost-constraint trigger**: any panel request that carries an explicit cost/token concern ("keep the cost down", "without burning tokens", "don't spend too much", "watch the token spend") now selects budget mode — the stated cost constraint IS the opt-in. The orchestrator confirms in one line ("Running in budget mode — say 'full panel' to override") and proceeds. A bare panel request with no cost language still never selects budget mode.
- **SKILL.md Budget Mode section** now opens with the two ways in, plus a "why opt-in, not default" rationale (sonnet reviewers < opus on subtle findings; 1 debate round < adaptive multi-round; 1 consolidated verifier < 3 dedicated passes — the redundancy that has caught judge-fabricated P0s; degraded rigor must be chosen and bannered, per the `[NO-DEBATE]` principle).
- **README**: "How to trigger it" block + "Why isn't budget the default?" paragraph under *Where the money actually goes*; Modes-table row updated.
- **Eval suite**: +2 trigger cases (`pos-budget-3` cost-constraint phrasing, `pos-budget-4` "token-efficient review").

No protocol changes — the budget-mode execution profile is exactly as shipped in 3.7.0.

## [3.7.0] — 2026-07-16 — Budget mode (measured-cost reduction profile)

Adds an explicit opt-in **budget mode** ("budget review", "cheap review", or `budget` to `/agent-review-panel`) that runs the same adversarial protocol shape at ~20–25% of full-run cost. Unlike generic "use cheaper models" advice, every cut targets a **measured** cost driver: a 2026-07-16 token audit of a real full-protocol run (2026-07-02, all phases + debate, $162) found the cost was NOT in the reviewer fan-out (~$12, 7%) but in the **orchestrator main loop ($111, 69%** — 157 turns re-reading a 270k→630k-token context, 58.7M cumulative cache-read tokens), duplicate judge passes (+P14.5 agent, $18), and the HTML report ($7 + main-loop driving).

### Added — Budget mode

- **Orchestrator turn diet** (targets the measured 69%): batched launches, persistent reviewers driven by SendMessage, ≤50-word agent returns, no inter-phase narration, ≤25 orchestrator-turn target (measured full run: 157), and fresh-session guidance when the conversation already carries heavy context.
- **Phase consolidation:** Phases 3+4 merged into one reviewer wave; exactly 1 debate round (round-1 state files still written, so `[NO-DEBATE]` stays honest); Phases 8+10+11 collapsed into ONE consolidated verification agent (`phase_8_10_11_verification.md`, prompt template in `references/prompt-templates.md`); Phase 12a-only; Phase 13 skipped (disputes go to the judge as `[UNVERIFIED]`); Phase 14.5 becomes an orchestrator grep-check (judge-hallucination protection retained, agent spin-up removed); Phase 15.1 markdown only (15.2/15.3 offered post-hoc — their agents read state files from disk, so nothing is lost).
- **Model tiering:** reviewers + consolidated verifier `model: "sonnet"` (explicit), Supreme Judge stays `model: "opus"`, single pass. The v2.14 force-opus rule is reworded to **explicit-model-always** — the rule was about silent fallthrough, not opus per se.
- **`[BUDGET-MODE]` banner** (💸, blue in post-hoc HTML) with stacking order NO-DEBATE → COMPRESSED → BUDGET-MODE, and a confidence rule: High only if the consolidated pass confirmed every P0/P1.
- **Incompatibilities declared:** multi-run (refuse), deep research (budget wins, noted in header), assessment mode (full protocol required).
- Review-Mode Spectrum row, 2 new eval-suite trigger cases, budget-mode fixture + parser support (`report.budgetMode.detected`), 12 new behavioral assertions. Tests: 443 → 484.

## [3.6.0] — 2026-06-28 — Assessment mode (quality discrimination + control-validation gate)

Adds a fourth review mode for **subjective-quality deliverables** (strategy reports, marketing/creative copy, pitches, research syntheses), where the failure mode is **saturation** — a generic "rate 0–10" panel scores a confident-but-empty draft as highly as a real one — not discrete defects.

### Added — Assessment mode

- **Mode-detection** row + an **Assessment** persona set: 4 GENERATED, domain-tailored adversarial archetypes (Domain-Authenticity / Executability-Operator / Decision-Maker-ROI / Intent-Fidelity), all high-intensity.
- **De-saturation scoring:** subtract-points + **veto** (fatal domain violation → 0), not add-points.
- **The swap test:** replace the subject's proper noun with a competitor's; if it still reads true, it has zero specificity.
- **Out-of-band currency check:** factual/freshness claims are verified against a curated checklist *outside* the panel — a persona can't tell current from stale (see skill `llm-judge-cant-detect-stale-or-fabricated-grounding`).
- **The control-validation gate (signature):** run a degenerate no-input control through the same personas; keep a persona only if it scores the control < ~3/10 — testing the panel against a known-bad floor (complements the Phase 6 CONSENSAGENT sycophancy check, which tests reviewer agreement). Run whenever scores look suspiciously uniform, in any mode.
- Origin: monksIQ China brand-report bake-off — a 6-judge panel's generic quality axes all saturated (a no-data control scored as high as real reports); the strongest models, asked to design their own panel, independently proposed these exact mechanisms.

## [3.5.0] — 2026-06-06 — Loud debate-skip (`[NO-DEBATE]` banner)

Closes [#56](https://github.com/wan-huiyan/agent-review-panel/issues/56). A 7-day audit of **51 real review runs** ([`docs/analysis/2026-06-06-debate-disappearance-audit.md`](docs/analysis/2026-06-06-debate-disappearance-audit.md)) found the adversarial **debate phase (Phase 5–7) ran in only 1 of 51 runs** — and, most concerning, invoking the skill did *not* reliably produce a debate (on inline/workflow execution shapes it silently collapsed to reviews → judge). The `SKILL.md` still mandates debate, so this is an **observability gap, not a spec regression**: make a debate-less run announce itself instead of passing silently.

### Added — `[NO-DEBATE]` banner (the load-bearing fix)

- **Detection anchored at the Phase 15.1 report-write chokepoint** — the terminal step every completed run passes through (the Phase 13.5 gate does *not* fire on the inline/workflow shapes, which is exactly how the audit's silent skips slipped past). Before writing the report, the orchestrator independently checks whether any `reviewer_*_phase_5_round1.md` state files exist. If **none** do, the adversarial debate never ran:
  - a `⚠️ [NO-DEBATE]` banner is stamped on `review_panel_report.md` **and** the HTML dashboard (amber palette, distinct from the red `[COMPRESSED]` banner);
  - every action item is suffixed `[NO-DEBATE]`;
  - the `**Confidence:**` header is **capped at Medium** (a no-debate run can never report High);
  - the "Debate Rounds" detail renders a "Phase 5 did not run" placeholder.
- **COMPRESSED / NO-DEBATE are distinct and stack** — `[COMPRESSED]` (a *specific* mandatory phase file lost after retry) vs `[NO-DEBATE]` (the *entire* Phase 5 absent). When both apply, NO-DEBATE renders first. Mirrors the v3.1 `[COMPRESSED]` machinery.

### Added — Phase 13.5 debate-presence assertion

The Pre-Judge Verification Gate now counts panel-wide `reviewer_*_phase_5_round1.md` files: if zero when mode = full panel, it must run Phase 5 or stamp `[NO-DEBATE]` — never proceed to the judge with zero debate output silently.

### Added — Review-Mode Spectrum + debate-in-Workflow recipe

- A **Review-Mode Spectrum** section (`SKILL.md` + README) clarifying when to use the full debate panel vs the streamlined / single-persona fast modes, and why debate lives in the skill's Agent-tool orchestration (not the parallel-fan-out Workflow engine).
- A canonical **debate-in-Workflow recipe** for ultracode/Workflow execution: round 1 reviewers → each re-runs with peers' round-1 findings injected (the cross-examination) → judge reconciles with the debate record. Authoring an explicit `Debate` phase is what makes the round-1 state files exist (and satisfies the NO-DEBATE check).

### Tests

- New `tests/fixtures/sample-report-no-debate.md` fixture + `report-structure.test.mjs` parser support (`report.noDebate.detected`) — asserts the banner is detected when Phase-5 state is absent (issue acceptance criterion).
- New `v3.5.0 loud debate-skip ([NO-DEBATE])` behavioral-assertion block validating the Phase 13.5 / 15.1 / 15.3 spec text, the confidence cap, the mode-spectrum doc, and the debate-in-Workflow recipe.

## [3.4.0] — 2026-06-04 — VoltAgent catalog expansion + drift automation

### Added — 30 new signal→specialist mappings

The Signal-Detected Specialist Mapping table in `SKILL.md` gained 30 content-signal rows, roughly doubling the auto-upgrade coverage. New signals: Vue/Nuxt, Angular, Next.js, React Native/Expo, Electron, Django, FastAPI, Spring Boot, Symfony, C/C++, Kotlin, Elixir, MLOps, reinforcement learning, prompt optimization, AI/agentic systems, database administration, incident response, Windows Server, cloud security, CLI tools, MCP servers, refactoring/legacy modernization, build systems, dependency/supply-chain, git workflows, game dev, API documentation, legal/licensing, and UX research. Every id was validated against the catalog snapshot (below). The sibling `plan-review-integrator` verification table gained the 10 code-relevant rows (Vue, Angular, Next.js, Django, FastAPI, C/C++, Kotlin, Elixir, React Native, MCP).

The catalog count claim was corrected from "127+" to "130+ across 10 families" (135 real agents in the vendored snapshot, README pseudo-files excluded).

### Added — catalog drift automation (vendored snapshot + CI gate)

VoltAgent agent ids in the mapping tables are hand-maintained editorial choices, but whether a referenced agent still *exists* upstream is a fact that drifts. New tooling detects that drift without making the editorial mapping itself "automatic" (runtime availability detection in Phase 1 already handles that, and a stale mapping degrades gracefully to a generic reviewer):

- `skills/agent-review-panel/references/voltagent-catalog.json` — vendored point-in-time snapshot of all 135 agents across 10 families, with a `_provenance` block (source repo, marketplace version, snapshot date, method).
- `scripts/refresh-voltagent-catalog.sh` — regenerates the snapshot from the locally installed `voltagent-subagents` marketplace (README files excluded).
- `scripts/voltagent-catalog-check.sh` — on-demand drift check: fails on any dangling reference across the live skill files; reports unmapped agents as FYI. Frozen-history files (changelogs, `docs/`) are excluded.
- `tests/voltagent-catalog.test.mjs` — the CI gate (CI runs `npm test`, which has no marketplace installed, so it validates against the committed snapshot). 5 new tests.
- `scripts/release-check.sh` — new section 8 enforces the same invariant in the pre-release sweep.

### Fixed

- **Pre-existing namespace mislabel** surfaced by the new drift check on its first run: the Risk Assessor persona's alternate mapping pointed at `voltagent-biz:risk-manager`, but `risk-manager` lives in `voltagent-domains`. Corrected to `voltagent-domains:risk-manager`. (The agent was never resolvable under the wrong namespace, so this persona silently fell back to generic before.)

### Tests

- `tests/voltagent-catalog.test.mjs` (5 tests): snapshot parses + carries provenance; counts are internally consistent and README-free; live refs reference ≥50 known ids; **no dangling references**; every referenced namespace resolves to a real family. Suite total 401 → 406, all green.

### Files Changed

- `skills/agent-review-panel/SKILL.md` — 30 new signal rows; risk-manager namespace fix; count claim 127+ → 130+; snapshot/refresh/check pointer; H1 + footer version bump
- `skills/plan-review-integrator/SKILL.md` — 10 new code-relevant verification rows
- `skills/agent-review-panel/references/voltagent-catalog.json` — new vendored snapshot
- `scripts/refresh-voltagent-catalog.sh`, `scripts/voltagent-catalog-check.sh` — new
- `tests/voltagent-catalog.test.mjs` — new; registered in `package.json` test script
- `scripts/release-check.sh` — new section 8 (catalog drift)
- Version bumps across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `eval-suite.json`, SKILL.md H1 + footer (3.3.0 → 3.4.0); README test-count 401 → 406

### Operational note

The three families that back several mappings — `voltagent-core-dev`, `voltagent-dev-exp`, `voltagent-biz` — are not installed by default. Install all 10 with `claude plugin install <name>@voltagent-subagents` (user scope; takes effect next session). Until installed, those personas fall back to generic reviewers exactly as before — no run breaks.

### Breaking changes

None. All changes are additive (new mapping rows, new tooling) plus one namespace correction; no phase, agent, or state-file changes.

## [3.3.0] — 2026-05-14 — Live-State Claim Discipline (#40)

### Added — Live-State Claim Discipline

Resolves [#40](https://github.com/wan-huiyan/agent-review-panel/issues/40). In a 2026-04-27 run, the panel (Security Auditor + Architecture + Devil's Advocate, all cross-citing each other) raised a P0 "IAM/IAP divergence" finding that was factually false. The agents read `echo "gcloud ... --role=..."` lines in two Cloud Run deploy scripts — operator-facing instructions *printed to the terminal* at deploy-completion time — as if they were the live IAM/IAP configuration of the deployed service. The false finding survived Phase 4 (private reflection), was *promoted* during Phase 5 debate, survived Phase 7 (blind final), and shaped the Supreme Judge's verdict. Five agents plus the judge missed it; a single `gcloud run services describe` would have falsified it in 30 seconds.

The new discipline is a cross-cutting rule set (not a new phase) injected into Phase 3 reviewer prompts, the Phase 5 debate prompt, Phase 11 severity verification, and the Phase 14 judge prompt. It applies to any finding asserting a fact about *live infrastructure or runtime state* — deployed IAM/IAP/auth config, a running cron schedule, a production env var, a BigQuery partition key, a load balancer's routing — and is **not** security-specific.

Four rules:

1. **Declarative vs. imperative vs. documentation** — reviewers must distinguish declarative config (`gcloud run deploy --flag`, Terraform, YAML — what the deploy WILL create) from imperative documentation (`echo "..."`, `print(...)`, comments, heredocs printed to a terminal, "usage"/"next steps" blurbs — what a human is TOLD to run later) from live state (`describe`-class command output — what production IS now). Lines inside `echo`/comments/usage blocks are documentation, never evidence for a live-state claim.
2. **Live-state claims need live evidence** — every live-state finding is tagged `[LIVE-VERIFIED]` (backed by `gcloud describe`/`get-iam-policy`, `bq show`, `aws describe-*`, `kubectl get`, `crontab -l` output) or `[STATIC-INFERENCE]` (inferred from source/config only). A `[STATIC-INFERENCE]` live-state claim is **capped at P1** regardless of reviewer count; P0 requires `[LIVE-VERIFIED]`.
3. **Consensus does not compound on a shared artifact** — 2+ reviewers agreeing off the *same* source lines (or cross-citing each other) is consensus on an *interpretation*, not independent verification of a *fact*. Phase 6 Sycophancy Detection flags it; the judge tags it `[STATIC-INFERENCE-CONSENSUS]` and counts it as one source, not three.
4. **Pre-promotion falsification check** — before any finding is promoted to P0 (in debate or by the judge), reviewers state the single observation that would prove it wrong and whether it is cheap to obtain. A P0 falsifiable by one read-only command that no agent ran is capped at P1 until verified.

Three new epistemic labels — `[LIVE-VERIFIED]`, `[STATIC-INFERENCE]`, `[STATIC-INFERENCE-CONSENSUS]` — are added to the Phase 15.1 epistemic-labels list and the Phase 14 judge classification step.

### Tests

- New `v3.3.0 Live-State Claim Discipline (#40)` describe block in `tests/behavioral-assertions.test.mjs` — asserts SKILL.md declares the discipline section with all four rules, lists the three new epistemic labels, and wires the rules into Phase 3/5/6/11/14; asserts `prompt-templates.md` carries the discipline in the Phase 3, 5, 11, and 14 prompts.
- New eval-suite test case `tc-v33-1` exercising the deploy-script-echo false-positive scenario.

### Files Changed

- `skills/agent-review-panel/SKILL.md` — new `## Live-State Claim Discipline (v3.3.0)` section; wiring into Phases 3, 5, 6, 11, 14; three new epistemic labels in the Phase 15.1 list
- `skills/agent-review-panel/references/prompt-templates.md` — Live-State Claim Discipline block in the Phase 3 prompt; falsification-check task in the Phase 5 prompt; live-state classification step in the Phase 11 prompt; severity-dampening and epistemic-label additions in the Phase 14 judge prompt
- `skills/agent-review-panel/references/signals-and-checklists.md` — new Live-State Claims checklist; live-state items added to the Auth/Security and Infrastructure checklists
- `skills/agent-review-panel/eval-suite.json` — `tc-v33-1` test case, version + `updated` bump
- Version bumps across `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `skills/agent-review-panel/eval-suite.json`, SKILL.md H1 header, and HTML footer instruction (3.2.0 → 3.3.0)

### Breaking changes

None. The discipline is additive — it adds tagging requirements and severity caps to existing phases but introduces no new phase, agent, or state file. Reports for work with no live-infrastructure claims render identically.

## [3.2.0] — 2026-04-27 — post-judge verification gate + Chart.js wrapper-div mandate (#41, #42)

### Added — Phase 14.5: Post-Judge Verification Gate

Resolves [#41](https://github.com/wan-huiyan/agent-review-panel/issues/41). The Supreme Judge in Phase 14 could introduce **new** P0/P1 findings in its Step-0 Verification Review — findings the panel never raised — that bypassed Phase 11 (Severity Verification) entirely, since Phase 11 only re-verifies panel-raised findings. A 2026-04-27 README run produced a hallucinated "12 unresolved git conflict markers" P0 (the file was clean — `wc -l` returned the expected count and `grep -c '<<<<<<<\|=======$\|>>>>>>>'` returned 0) and that single fabricated finding drove a 3/10 REJECT-AND-REWRITE verdict.

Phase 14.5 runs after Phase 14 and before Phase 15.1. A single Opus agent classifies every P0/P1 in the judge ruling as `[PANEL-RAISED]` (skip — covered by Phase 11) or `[JUDGE-INTRODUCED]` (verify here), then runs an appropriate ground-truth check (grep, Read, git status, git diff, wc) per claim type. Each judge-introduced finding gets one of three verdicts: `[JUDGE-CONFIRMED]` (replicates, passes through), `[JUDGE-HALLUCINATED]` (does not replicate — demoted to P3 or removed), or `[JUDGE-PARTIAL]` (some sub-claims replicate — demoted one level, edited to retain only the verified portion).

When any P0 is demoted to `[JUDGE-HALLUCINATED]` or removed, the verdict score is recomputed against the panel mean (rounded to one decimal) and a `> ⚠️ Judge Verification:` banner appears at the top of `review_panel_report.md` and the HTML dashboard. Affected action items keep the `[JUDGE-HALLUCINATED]` epistemic-label suffix in both formats.

### Added — Chart.js wrapper-div mandate in Phase 15.3 rendering spec

Resolves [#42](https://github.com/wan-huiyan/agent-review-panel/issues/42). Every Chart.js `<canvas>` in `review_panel_report.html` now MUST be wrapped in a `<div style="position: relative; height: 220px; width: 100%;">`. The bare `<canvas height="...">` attribute is a no-op when `responsive: true` (Chart.js overrides the canvas's internal pixel buffer on first paint), and the dashboard always uses `maintainAspectRatio: false`. Without a height-bounded relative parent, the canvas grows on every layout pass — infinite vertical growth on open, scroll, resize, or interaction.

User report from the 2026-04-27 README run: *"the top section kept on expanding to be longer and longer as i open the html"*. Verified that wrapping the two reproduction-failing canvases in 220px-tall relative parents stabilized the layout completely. The mandate is in `references/prompt-templates.md` Phase 15.3 section, surfaced in `SKILL.md` Phase 15.3 architecture, and asserted by a new behavioral test that greps the prompt for the position-relative + explicit-pixel-height pattern.

### Tests

- New describe blocks in `tests/behavioral-assertions.test.mjs`: `v3.2.0 post-judge verification gate (Phase 14.5)` and `v3.2.0 Chart.js wrapper-div mandate (Phase 15.3)`. 7 new tests, total 379 → 386.
- Asserts SKILL.md declares Phase 14.5 between Phase 14 and Phase 15, lists it in the orchestration block, includes `[JUDGE-HALLUCINATED]` in the epistemic-labels list, and references `phase_14_5_judge_verification.md` in the state-file inventory.
- Asserts `prompt-templates.md` defines a Phase 14.5 prompt block with all three judge-finding verdict labels, the score-recomputation step, and the disk-write protocol.
- Asserts `prompt-templates.md` Phase 15.3 mandates `position: relative` + explicit `height: NNNpx` + WHY explanation, and `SKILL.md` surfaces the same mandate.

### Breaking changes

None. Adding Phase 14.5 is purely additive — runs a new agent in a step that previously had no agent. Existing reports without `[JUDGE-HALLUCINATED]` action items render identically. The `state/phase_14_5_judge_verification.md` file is net-new (a stub is written even when no judge-introduced findings exist, so Phase 15.1's disk-read always succeeds).

### Design references

- Issue [#41](https://github.com/wan-huiyan/agent-review-panel/issues/41) (Phase 14 hallucinated P0s)
- Issue [#42](https://github.com/wan-huiyan/agent-review-panel/issues/42) (Chart.js infinite-growth bug)
- Memory: `feedback_judge_can_hallucinate_p0s.md`, `feedback_chartjs_canvas_unbounded_growth.md`
- Chart.js Responsive docs: https://www.chartjs.org/docs/latest/configuration/responsive.html
- Canonical Chart.js issue thread: https://github.com/chartjs/Chart.js/issues/4156

---

## [3.1.0] — 2026-04-27 — silent-phase-compression fix (#35)

### Fixed — silent compression of mandatory Phases 4 / 5 / 7

Under context-budget pressure, the v3.0.0 orchestrator silently inlined Phases 4 (private reflection), 5 (debate rounds), 6 (round summaries), and 7 (blind final assessments) into the Supreme Judge step, producing deliverables indistinguishable from full runs. Empirical cost measured at 6 net-new findings (including 1 P0 FERPA / Anthropic-DPA gap) missed by a compressed run versus the corrective full-run review on the same input. Fixes [#35](https://github.com/wan-huiyan/agent-review-panel/issues/35).

### Architectural changes

- **File-based subagent state.** All Phase 3 / 4 / 5 / 7 / 8 / 10 / 11 / 14 outputs now write to `state/<file>.md` under the review output directory; subagents return only `{path, 100-word summary}` rather than verbatim review content. Eliminates the orchestrator-context bloat (~75k tokens per phase × 6 phases) that drove silent compression. Multi-run mode namespaces under `state/run_<N>/`.
- **Phase 13.5 — Pre-Judge Verification Gate (NEW).** Before launching the Supreme Judge, the orchestrator verifies all mandatory phase outputs exist on disk + meet a minimum-bytes threshold (≥500 B) + contain required schema headers. Single retry on failure; persistent miss triggers the COMPRESSED RUN warning rather than a silently incomplete report.
- **Phase 14 reads state on demand.** Launch prompt is ~200 tokens of paths; the judge uses the Read tool to load specific state files. Mirrors the v2.16.4 Phase 15.3 HTML-agent pattern. The judge's ruling materializes to `state/phase_14_judge_ruling.md` so Phase 15.1 can later consume it from disk.
- **`⚠️ COMPRESSED RUN` header in Phase 15.1.** When the gate detects unrecoverable phase loss, the markdown report begins with a fail-loud blockquote listing the skipped phases; every action item gains a `[COMPRESSED]` epistemic-label suffix. Phase 15.3 renders the same warning as a red HTML banner above the summary card.

### Tests

- New fixture: `tests/fixtures/sample-report-compressed-run.md` and golden snapshot `tests/golden/sample-report-compressed-run.golden.json`.
- `tests/report-structure.test.mjs` parser extended to extract `report.compressedRun.{detected, phasesSkipped}`.
- `tests/behavioral-assertions.test.mjs` gains a `v3.1.0 file-based state convention` describe block validating SKILL.md documents the new architecture.
- 379 / 379 tests pass.

### Breaking changes

None. The `state/` directory is net-new and may be `.gitignore`d if not desired in commits. Existing report consumers see unchanged report files for full runs and a leading warning blockquote for compressed runs.

### Design references

- Design doc: `docs/plans/2026-04-27-silent-phase-compression-fix-design.md`
- Implementation plan: `docs/plans/2026-04-27-silent-phase-compression-fix-plan.md`

## [3.0.0] — 2026-04-27

### Changed — Single-plugin layout (BREAKING) (PR #33)

Collapsed the multi-plugin marketplace into a single plugin that bundles both skills, mirroring the structure used by [obra/superpowers](https://github.com/obra/superpowers). Layout reasoning: when a marketplace ships exactly one plugin and that plugin bundles its skills, the extra `plugins/<name>/` nesting layer is pure ceremony. Removing it makes the install UX one command instead of two and keeps the auto-discovery convention from PR #30 intact (`<plugin-root>/skills/<skill-name>/SKILL.md`).

- `.claude-plugin/plugin.json` now lives at the repo root (was `plugins/agent-review-panel/.claude-plugin/plugin.json`).
- Skills moved to `skills/agent-review-panel/` and `skills/plan-review-integrator/` at the repo root (were nested under `plugins/<plugin-name>/skills/<skill-name>/`).
- `marketplace.json` reduced to a single plugin entry with `source: "./"`.
- `plugins/` directory deleted.

### Considered but rejected — Plugin rename revert (PR #32)

PR #32 proposed reverting the v2.16.2 rename `roundtable` → `agent-review-panel` so plugin / skill / marketplace all share one name (slash command would have become `/agent-review-panel:agent-review-panel`). Reasoning made sense under the multi-plugin layout (where `roundtable` was just one of two plugin names and the divergence created friction) but lost force under the single-plugin bundle: when one plugin holds N skills, a distinct bundle name *helps*. `roundtable` works as a collective noun for the bundle, and `/roundtable:agent-review-panel` reads as "the agent-review-panel skill of the roundtable" — meaningful — whereas `/agent-review-panel:agent-review-panel` would read as stutter. Decision: keep `roundtable`. PR #32's `release-check.sh` script is folded in (see below); the rename portion is shelved.

### Changed — Test discovery rewritten for single-plugin model

- `tests/manifest-consistency.test.mjs` — walks `skills/<name>/` under one root `plugin.json`. Marquee skill (where `name == plugin.name`) tracks `plugin.json` version exactly; other skills version independently.
- `tests/trigger-classification.test.mjs` — walks `skills/<name>/eval-suite.json`.
- `tests/eval-suite-integrity.test.mjs` and `tests/behavioral-assertions.test.mjs` — hardcoded paths updated from `plugins/agent-review-panel/...` to `skills/agent-review-panel/...`.
- 345/345 tests pass.

### Added — `scripts/release-check.sh` (folded in from PR #32)

Pre-release doc-drift detector. Asserts slash-command consistency, marketplace-name consistency, test-count accuracy, canonical-version match across 5 files, ROADMAP row presence, CHANGELOG section presence. Auto-detects plugin name from `plugin.json` so it stays correct across future renames. Run with `bash scripts/release-check.sh`.

### Migration

Pre-v3.0 install command that **no longer exists**:

```bash
claude plugin install plan-review-integrator@agent-review-panel  # GONE (skill is now bundled into roundtable)
```

New install (one command, both skills bundled):

```bash
claude plugin marketplace add wan-huiyan/agent-review-panel
claude plugin install roundtable@agent-review-panel
```

The install handle `roundtable@agent-review-panel` is unchanged from v2.16.2–v2.16.5.

### Bumped

- `package.json`: 2.16.5 → 3.0.0
- `.claude-plugin/plugin.json` (new at root): 3.0.0
- `.claude-plugin/marketplace.json` entry: 2.16.5 → 3.0.0
- `skills/agent-review-panel/eval-suite.json`: 2.16.5 → 3.0.0
- `skills/agent-review-panel/SKILL.md`: header `v2.16.5` → `v3.0.0`; HTML footer instruction updated to match
- `skills/plan-review-integrator/SKILL.md`: frontmatter `version: 2.0.0` → `2.0.1` (was drifted from its eval-suite.json which was already at 2.0.1)

### Notes

- This release supersedes the open PR #32. The `release-check.sh` script is folded in; the rename revert is rejected (see "Considered but rejected" above).
- PR #30's auto-discovery convention is preserved: skills still live at `<plugin-root>/skills/<skill-name>/SKILL.md` with no `skills` field declared in `plugin.json`.

## [2.16.5] — 2026-04-19

### Fixed — Plugin skills layout for Claude Code ≥2.1.112 manifest validation (PR #30)

Claude Code 2.1.112 rejected both `skills` field values the plugin had historically used: `["./"]` failed with *"Path escapes plugin directory"*, and `["SKILL.md"]` failed with *"Validation errors: skills: Invalid input"*. Neither value was portable across versions.

- **Restructured to canonical nested layout.** `SKILL.md` now lives at `plugins/<name>/skills/<name>/SKILL.md` and the `skills` field has been dropped from `plugin.json` entirely. Claude Code's default skill auto-discovery loads the skill without any manifest path declaration, sidestepping both validation bugs.
- Resolves #28.

### Thanks

- [@okuuva](https://github.com/okuuva) — first external contribution, via [#30](https://github.com/wan-huiyan/agent-review-panel/pull/30).

### Bumped

- `package.json`: 2.16.4 → 2.16.5
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.4 → 2.16.5
- `plugins/agent-review-panel/eval-suite.json`: 2.16.4 → 2.16.5
- `.claude-plugin/marketplace.json` (roundtable entry): 2.16.4 → 2.16.5
- `plugins/agent-review-panel/skills/agent-review-panel/SKILL.md`: header `v2.16.4` → `v2.16.5`; HTML footer instruction updated to match

---

## [2.16.4] — 2026-04-15

### Fixed — Phase 15.3 Reliability (HTML Report Generation)

Phase 15.3 (Interactive HTML Report) silently failed in most runs because the orchestrator's context window was near capacity after 14 phases, causing the subagent launch to fail.

- **Sequential Phase 15:** 15.1 → 15.2 → 15.3 (no longer parallel). Latency impact: ~2s.
- **Disk-reading data strategy:** Phase 15.3 agent reads `review_panel_report.md`, `review_panel_process.md`, and the rendering spec from `references/prompt-templates.md` directly. Orchestrator prompt drops from 700+ lines to ~10 lines.
- **Verification gate:** Mandatory file-existence check for all 3 output files before reporting completion. Auto-retry once if HTML is missing.
- **Manual recovery path:** "generate the HTML review report" launches the Phase 15.3 agent with the same disk-reading prompt, following the authoritative spec.
- **Path resolution:** Orchestrator resolves `{output_dir}` and `{skill_dir}` to absolute paths. Custom filenames handled.
- **Legacy language fix:** Updated `prompt-templates.md` Reference Inputs section to align with disk-reading strategy.
- **Version unification:** SKILL.md heading and HTML footer instruction now show the full semver (`v2.16.4`) instead of the bare major version (`v2.16`). Single source of truth: `plugin.json` version is the canonical version; SKILL.md heading and footer instruction must match it on every bump.

---

## [2.16.3] — 2026-04-09

### Added — External Domain Claim Web Verification in Phase 11

Motivated by a real gap in the PUMA GA4 audit: all 4 reviewers unanimously flagged "Data Retention set to 50 months confirms GA4 360" as P0, but none verified whether 50 months is even a valid GA4 setting. The existing Phase 13 Deep-tier web search only triggers for **unresolved disputes** — consensus P0 findings bypass it because there's no dispute to route.

- **Phase 11 step 5:** For each P0/P1, the severity verification agent now classifies whether the finding depends on external domain knowledge (product limits, API behavior, regulatory jurisdiction, pricing tiers, etc.). External claims get a web search (cap: 2 searches per claim, 5 claims max).
- **New labels:** `[WEB-VERIFIED]` (confirmed by authoritative source), `[WEB-CONTRADICTED]` (external source disagrees — auto-demotes severity by 1 level), `[WEB-INCONCLUSIVE]` (flagged for judge).
- **Regulatory/jurisdiction claims** (e.g., "GDPR applies to Mexico") are ALWAYS classified as external domain claims.
- **Extended severity verification table** now includes Domain Type, Web Result, Source URL, and Adjusted Severity columns.

In the PUMA audit, this would have auto-verified "50 months = GA4 360" via Google's Admin API docs and auto-demoted "GDPR applies to Mexico" via `[WEB-CONTRADICTED]`.

---

## [2.16.2] — 2026-04-08

### Fixed — Plugin layout bug that silently broke all marketplace installs
- **`plugins/<name>/.claude-plugin/plugin.json` now declares `"skills": ["./"]`.** Without this field, Claude Code's plugin loader does NOT auto-discover `SKILL.md` at the plugin root — it only looks in the default `skills/<name>/SKILL.md` sub-directory. Every install since PR #18 (v2.16) has been silently loading the plugin with ZERO registered skills. Users hit `Unknown skill: agent-review-panel` the first time they tried the slash command on a clean install, because the skill was never loaded in the first place. Empirically confirmed by `claude --debug --plugin-dir ./plugins/agent-review-panel` reporting no skills loaded on the pre-fix layout, and reporting both `agent-review-panel:agent-review-panel` and `plan-review-integrator:plan-review-integrator` loaded on the post-fix layout.
- **Why nobody noticed for two weeks:** users who previously had `~/.claude/skills/agent-review-panel/` from a pre-PR-#18 manual clone had that loose-skill install shadowing the broken marketplace install (exactly the stale-clone gotcha PR #19 documented). The plugin "worked" because the loose skill worked, not because the plugin did. Anyone who clean-installed for the first time hit the bug immediately.
- **Structural tests didn't catch it** because `tests/manifest-consistency.test.mjs` validates file structure and JSON schema, not actual plugin-loader behavior. We now know: `claude plugin validate` checks the manifest schema but doesn't tell you whether the skill will actually load — the only empirical check is `claude --debug --plugin-dir ./plugins/<name> --print "list skills"` and reading the loaded-skills list. Consider adding this as a test step in a future PR.

### Fixed — plan-review-integrator manifest schema error (inherited from upstream)
- `author: "wan-huiyan"` (string) → `author: {"name": "wan-huiyan", "url": "https://github.com/wan-huiyan"}` (object). The schema requires an object; the string form was an upstream bug that `claude plugin validate` now rejects.

### Fixed — README documented the wrong slash command
- All `/agent-review-panel` slash command references updated to `/agent-review-panel:agent-review-panel` (the namespaced form that plugin skills actually get). A new ⚠️ callout explains the `/<plugin>:<skill>` convention and reminds users that natural-language invocation works either way.

### Bumped
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.1 → 2.16.2
- `plugins/agent-review-panel/eval-suite.json`: 2.16.1 → 2.16.2
- `package.json`: 2.16.1 → 2.16.2
- `plugins/plan-review-integrator/.claude-plugin/plugin.json`: 2.0.0 → 2.0.1
- `plugins/plan-review-integrator/eval-suite.json`: 2.0.0 → 2.0.1
- `.claude-plugin/marketplace.json`: both entries bumped to match

## [2.16.1] — 2026-04-08

### Changed — Marketplace bundle (PR #22)
- **Renamed marketplace** `wan-huiyan-agent-review-panel` → `plugin`. Install command is now `/plugin install agent-review-panel@plugin` (was `@wan-huiyan-agent-review-panel`).
- **Bundled `plan-review-integrator` v2.0.0** as a second plugin in the same marketplace. The full review→integrate pipeline now ships from one repo. The old standalone `wan-huiyan/plan-review-integrator` repo is archived in favor of `/plugin install plan-review-integrator@plugin`.
- **Per-plugin `eval-suite.json`** — moved from repo root to `plugins/agent-review-panel/eval-suite.json` and added `plugins/plan-review-integrator/eval-suite.json`. Tests discover eval-suites under each plugin's directory; the multi-plugin manifest test iterates all plugins independently.
- **Refactored `tests/manifest-consistency.test.mjs` and `tests/trigger-classification.test.mjs`** to multi-plugin discovery. Each plugin's plugin.json, eval-suite.json, SKILL.md, and marketplace entry are validated independently. Red-test validation: drifting either plugin's `plugin.json` version produces ≥3 independent failures (eval-suite cross-version, marketplace cross-version, SKILL.md H1 header).
- **Cross-version assertions from PR #21** generalized for multi-plugin: the H1 header check (`# <title> v<major>.<minor>`) and HTML footer check are now run per-plugin and skip cleanly when a plugin's SKILL.md doesn't carry that pattern (e.g. plan-review-integrator has no HTML footer instruction).
- **Breaking change for existing installs.** Anyone who installed via `wan-huiyan-agent-review-panel` or `wan-huiyan-plan-review-integrator` must uninstall + reinstall under the new `@plugin` marketplace name. See README "Migration from previous marketplaces" for the exact commands.

### Bumped
- `plugins/agent-review-panel/.claude-plugin/plugin.json`: 2.16.0 → 2.16.1
- `plugins/agent-review-panel/eval-suite.json`: 2.16.0 → 2.16.1
- `package.json`: 2.16.0 → 2.16.1
- `plugins/plan-review-integrator/.claude-plugin/plugin.json`: 1.4.0 → 2.0.0 (major bump marks marketplace move; plugin behavior unchanged)
- `plugins/plan-review-integrator/eval-suite.json`: 1.0.0 → 2.0.0 (was upstream-drifted from plugin.json's 1.4.0 since the file's first commit; brought into lockstep here)
- `plugins/plan-review-integrator/SKILL.md`: header `v1.3` → `v2.0` (matched plugin.json)
- `.claude-plugin/marketplace.json`: top-level `name` renamed; plugin entries updated; new `plan-review-integrator` entry added

## [2.16.0] — 2026-04-07

### Changed — Plugin layout (PR #18)
- **Restructured to canonical `plugins/<name>/` layout** for Claude Code plugin marketplace compliance. The skill now lives at `plugins/agent-review-panel/SKILL.md` with the plugin manifest at `plugins/agent-review-panel/.claude-plugin/plugin.json`. The marketplace manifest moved from repo root to `.claude-plugin/marketplace.json`. The `source` field in `marketplace.json` now points to `./plugins/agent-review-panel` (previously `.`).
- **Fixed 3-layer plugin install bug:** root-level `marketplace.json` was silently ignored by `claude plugin marketplace add`; and `"source": "."` returned `Invalid schema: plugins.0.source`.
- **Marketplace name:** `agent-review-panel` → `wan-huiyan-agent-review-panel` (owner-prefixed for uniqueness across `wan-huiyan-*` marketplaces).
- Added `$schema` and top-level `description` to `marketplace.json`.
- Updated `manifest-consistency.test.mjs` and `trigger-classification.test.mjs` with canonical discovery helpers matching `wan-huiyan/causal-impact-campaign#11`.

### Fixed — README install command (PR #19)
- **Corrected marketplace name** in all install commands. The command `@agent-review-panel` failed silently after PR #18 renamed the marketplace — users who followed the README literally could not install the plugin. Fixed 3 broken instances (Quick Start, Installation §, Uninstalling §) to use `@wan-huiyan-agent-review-panel`.
- **Added `### Updating to the latest version` subsection** with the standard update flow, verification command, clean-reinstall fallback, and stale-local-clone troubleshooting. The stale-clone gotcha was the root cause of two users this week getting degraded output labeled "v2.15" but structurally generated by older skill versions — Claude Code loads `~/.claude/skills/` before the marketplace cache, so a pre-marketplace git clone silently shadows plugin updates.
- Corrected cache path in the verify command: `cache/<marketplace>/<plugin>/<version>/.claude-plugin/plugin.json` (not `cache/<marketplace>/plugins/<plugin>/...`) — the install process flattens the repo's `plugins/` intermediate directory and adds a version segment. Uses a `*` glob so users don't need to look up the version first. Caught by dogfooding a live install against the PR #19 branch.

### Fixed — README polish + version drift cleanup (PR #20)
- **Deduplicated install commands** — the same 2-line `/plugin marketplace add` + `/plugin install` block appeared verbatim in both Quick Start AND the "Claude Code marketplace (recommended)" subsection, creating reader confusion ("is one version different?"). Removed the duplicate from Installation § and replaced with a cross-link to Quick Start. Kept the CLI equivalent, the `@<marketplace-name>` callout, and the "Why the marketplace path?" explanation.
- **New `### Requires Claude Code` subsection at top of Installation §** — explicitly states this plugin does NOT work with the Claude desktop app, claude.ai web interface, or Claude API direct, with the reasons (no Agent tool, no subagent spawning, no `/plugin` surface) and a list of supported Claude Code environments (CLI, VS Code extension, JetBrains extension). Previously this requirement was buried in Prerequisites at line 299 where users didn't read before copy-pasting Quick Start.
- **Rebranded `skill` → `plugin` at the product level** (minimal sweep — 3 locations): the "Claude Code" badge now says "plugin" (not "skill"), the tagline reads "A Claude Code **plugin** that orchestrates..." (not "skill"), and a new blockquote immediately after the tagline clarifies: _"Packaged as a Claude Code plugin (containing the `agent-review-panel` skill)."_ Leaves the ~15 body mentions of "skill" alone because they correctly refer to the inner capability (e.g., "the skill auto-detects content type"), filesystem paths (`~/.claude/skills/`, `SKILL.md`), or unrelated contexts (Cursor section, Companion Skills section).
- **Version drift cleanup across non-canonical files:**
  - `package.json`: `2.15.0` → `2.16.0` (was silently drifted; no test guards this against `plugin.json`)
  - `eval-suite.json`: `2.15.0` → `2.16.0` (same silent drift)
  - `plugins/agent-review-panel/SKILL.md` line 34 header: `# Agent Review Panel v2.15` → `# Agent Review Panel v2.16` (product version header)
  - `plugins/agent-review-panel/SKILL.md` line 1076 HTML footer instruction: `"Agent Review Panel v2.15"` → `"Agent Review Panel v2.16"` with a parenthetical note that the footer should match the current product version from `plugin.json`, not the version that introduced the HTML features
- **Fixed stale "Both SKILL.md files" claim** in README Tests section (line 336) — pre-v2.16 leftover from when there was a root `SKILL.md` + `skills/agent-review-panel/` mirror. After PR #18, there's only one canonical `SKILL.md` at `plugins/agent-review-panel/SKILL.md`.
- Updated version references across test comments and table rows to mention v2.16 where appropriate. Feature-marker mentions of "v2.15" (e.g., _"new in v2.15 — expandable 10-section issue cards"_) correctly stay as-is because they describe when features were introduced.

### Full test coverage validated (PR #20)
All 7 test-plan items executed end-to-end using Chrome to render the PR branch README and click each anchor link:
- ✅ Badge renders "plugin" (orange)
- ✅ Blockquote on line 11 renders with vertical bar (not code)
- ✅ Anchor: `[details below](#requires-claude-code)` scrolls correctly
- ✅ Anchor: `[Quick Start](#quick-start)` scrolls correctly (from both link instances)
- ✅ Anchor: `[Updating](#updating-to-the-latest-version)` scrolls correctly
- ✅ Anchor: `[Manual clone](#manual-clone-development--custom-setup)` scrolls correctly (GitHub's double-hyphen slug for `/` works as predicted)
- ✅ `grep -c "agent-review-panel@wan-huiyan-agent-review-panel" README.md` returns 7 (was 8 before dedupe)
- ✅ All 16 remaining "skill" mentions in README body are contextually correct

## [2.15.0] — 2026-04-07

### Added
- **Expandable 10-section issue cards in Phase 15.3 HTML report.** Each issue card is a native `<details>` element that expands to reveal a nested accordion with 10 sections: 📖 Narrative (full reviewer reasoning, verbatim), 📄 Code Evidence (Prism.js-highlighted snippets with file:line headers), 👥 Raised by (per-reviewer rating + reasoning), 🔍 Verification Trail (full VR agent output), 💬 Debate (round-by-round transcript), ⚖️ Judge Ruling, 🛠️ Fix Recommendation (proposed change + before/after code + regression test + blast radius + effort), 🔗 Cross-references (related findings with relationship labels), 🏷️ Epistemic Tags (hover tooltips), 📊 Prior Runs (meta-review comparison).
- **8 new REQUIRED fields** in the Phase 15.3 schema per action item: `narrative`, `codeEvidence`, `reviewerRatings`, `debateTranscript`, `judgeRuling`, `fixRecommendation`, `crossRefs`, `priorRuns`. Empty arrays/null acceptable but the field must be present. Empty sections render "No {section} data" placeholders so every card has consistent structure.
- **Phase 15.2 process history passed as Reference Input to Phase 15.3** — the HTML agent now receives the verbatim process history alongside the summarized report, enabling it to extract real narratives, debate exchanges, and judge rulings per finding. Token cost: ~10–20KB per review.
- **Deep-link support** — `report.html#issue-A1` auto-opens the matching card, scrolls to it, and pulses a highlight ring.
- **Keyboard navigation** — ↑/↓ between cards, Enter/Space expands, Home/End jump to first/last, `/` focuses search.
- **Expand all / Collapse all** buttons at the top of the Issues tab (operates on visible cards only).
- **Print-friendly `@media print` CSS** — forces all details open, inverts dark theme, hides charts and filters, sets `page-break-inside: avoid` per card.
- **Prism.js CDN dependency** (new) — `https://cdn.jsdelivr.net/npm/prismjs@1.29.0` for syntax highlighting. Uses prism-tomorrow theme + autoloader plugin. Graceful fallback to unstyled `<pre>` if CDN unreachable.
- **Soft 500KB size cap** with optional slim mode that drops verbatim `fullEvidence` and `debateTranscript` when exceeded.
- 4 new manifest-consistency tests: 10-section spec coverage, 8 new schema fields present, Prism.js documented, SKILL.md mentions v2.15 features.
- v2.15 eval-suite category + coverage describe block + 3 new triggers.

### Motivation
A compliance gap in the v2.13 nice-shtern sample: the Phase 15.3 HTML rendered 22 flat issue cards with no expand mechanism, even though the prompt template already specified a "▶ View evidence" button. Root cause: the schema only populated rich evidence fields for findings that went through Phase 13 verification. For non-verified findings, the HTML agent had nothing to expand, so it silently omitted the expand button entirely — degrading the whole UX to one-liner cards. v2.15 fixes this by making all 8 deep-detail fields required (with empty-placeholder rendering) and routing Phase 15.2 content into Phase 15.3.

## [2.14.0] — 2026-04-07

### Added
- **Phase 2: Data Flow Trace** — a dedicated agent traces data through the critical path(s) of the work BEFORE reviewers begin, targeting composition defects (two individually-correct functions producing incorrect results together — the `apply_date_mask` + `prep_df` class of bug). Uses Meta's semi-formal certificate prompting (2026, 78%→93% accuracy): at each function boundary, produce INPUT_SCHEMA → TRANSFORM → OUTPUT_SCHEMA → COMPOSITION_CHECK → INVARIANT_STATUS. Five mandatory invariant checks: schema preservation, transform/back-transform completeness, row count stability, null semantics, temporal consistency. Three user-selectable tiers: **Standard** (default, single path, ~5 min), **Thorough** (top 3 paths + completeness checks, ~15 min), **Exhaustive** (all paths, no token limit, aims to catch all bugs). Skipped for pure docs/plans or code with no data transforms.
- **Multi-Run Union Protocol + Phase 16: Merge** — invoke `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions, then merge via Phase 16. Rotation: Run 1 = standard base, Run 2 = complementary (Code Quality Auditor + Performance Specialist + Methodology Analyst + DA), Run 3 = adversarial-heavy (3 DAs with different reasoning strategies + Correctness Hawk), Run 4+ cycles. **Key rule:** content classification runs ONCE (Run 1) and is reused — eliminates the primary source of cross-run variance documented in the v2.10 consistency analysis. Phase 16 deduplicates by location + bug class, scores stability as `[K/N RUNS]`, uses highest severity when runs disagree, resolves judge divergence.
- **Force `model: "opus"` on all launches** — fixes a silent bug introduced in v2.9: the skill said "all agents use opus" but the VoltAgent Step 4 launch instructions omitted the model parameter, causing agents to fall through to their frontmatter-declared default model (potentially sonnet or haiku). Now ALWAYS pass `model: "opus"` explicitly alongside `subagent_type`. New `manifest-consistency` test greps all `subagent_type:` launches and asserts `model: "opus"` on the same line.
- **Two new checklists** in `references/signals-and-checklists.md`: Transform/Back-Transform Completeness (8 items) + Data Flow Invariants (8 items). Used by the Phase 2 Data Flow Tracer.
- **Two new prompt templates** in `references/prompt-templates.md`: Phase 2 Data Flow Tracer (~90 lines), Phase 16 Merge Agent (~60 lines).

### Changed
- **Integer phase renumbering** — all phases renumbered from decimal hierarchy (1, 2, 2.5, 3, 3.5, 4, 4.5, 4.55, 4.6, 4.7, 4.8, 4.8a, 4.8b, 4.9, 5, 6, 6.1, 6.2, 6.3) to sequential integers (1–16). Phase 15 retains sub-phases 15.1/15.2/15.3 as parent "Output Generation" because those represent parallel output generation. Phase 12 retains sub-parts 12a and 12b (two-step tier assignment pipeline).

### Motivation
Two identical panel runs on the same the causal client webapp (v2.10) produced only ~30% finding overlap, each missing a different P0 bug. Root causes: (1) LLM-driven content classification produces different persona compositions, (2) single-run coverage catches only ~60-70% of discoverable issues, (3) composition/seam bugs require dedicated tracing — no prior phase targeted this bug class, (4) silent model mixing via VoltAgent `subagent_type` without explicit `model: "opus"` override.

## [2.13.0] — 2026-04-03

### Added
- **Persona profiles surfaced in both process history and HTML dashboard.** Every agent now has a structured profile: role, agreement intensity (panelists), reasoning strategy, domain focus, agent type (VoltAgent or generic), matched-claim-type (Phase 13 agents), phases active.
- **Phase 15.2 (Process History):** Persona Profiles Registry at the top listing all agents, plus inline profile blocks immediately before each agent's first output.
- **Phase 15.3 (HTML):** Panel Gallery section with three sub-groups — Panel Reviewers (avatar cards, click to filter issues), Verification Specialists (linked to dispute points), Support Agents (compact cards with phase badges). Issue cards show "Raised by" avatar chips and verification agent persona in the expanded evidence panel. Cross-linking: clicking a persona chip scrolls to and highlights that agent's card in the Panel Gallery.

## [2.12.0] — 2026-04-03

### Added
- **Triple output format.** Phase 6 restructured from 1 → 3 output files:
  1. **`review_panel_report.md`** — existing primary report (unchanged)
  2. **`review_panel_process.md`** — verbatim "director's cut" of every agent's output in chronological order. Orchestrator-assembled, no new agent needed.
  3. **`review_panel_report.html`** — interactive dashboard generated by a dedicated Opus agent. Tailwind CSS + Chart.js via CDN. Stats row, three charts (confidence distribution, tier breakdown, verdict breakdown), filterable/sortable issue cards with expandable evidence panels, collapsible consensus/disagreement sections.
- Phase 6.1 runs first; 6.2 (orchestrator write) and 6.3 (Opus agent) run in parallel.

## [2.11.0] — 2026-04-03

### Added
- **Phase 4.8: Verification Tier Assignment** — a two-step pipeline. 4.8a (no agent): orchestrator derives initial tiers from Phase 2.5 confidence ratings + debate round signals. Low-confidence or multi-round unresolved → Deep; mixed → Standard; all-high + simple fact → Light. 4.8b (Opus agent): reviews the draft and overrides where signals are misleading.
- **Phase 4.9: Targeted Verification Agents** — one agent per dispute, launched in parallel. Persona-matched to claim type (statistical → Data Scientist, code correctness → Code Reviewer, security → Security Auditor). VoltAgent specialists preferred when available. Tiered budgets: Light ~2k tokens (read-only), Standard ~8k (multi-file), Deep ~32k (web search). Verdicts: `[VR_CONFIRMED]`, `[VR_REFUTED]`, `[VR_PARTIAL]`, `[VR_INCONCLUSIVE]`, `[VR_NEW_FINDING]`.
- **Phase 5 judge updated** to receive the Verification Round Summary as 8th input. Step 2 ("Rule on Each Disagreement") now gives significant weight to VR verdicts.
- Inspired by [MiroFish](https://github.com/666ghj/MiroFish)'s heterogeneous agent architecture — distinct agent personalities matched to tasks based on the task's domain characteristics.

## [2.10.0] — 2026-03-30

### Added
- **Codebase State Check (Phase 1, Step 3c)** — Detects worktree/branch divergence before review begins. Prevents the panel from flagging code as "missing" when it exists on main but not in the reviewed branch. Motivated by a real engagement where 4 reviewers + completeness auditor unanimously flagged a class as "non-existent" — but it existed on `main` (merged via a PR after the worktree branched).

## [2.9.0] — 2026-03-28

### Added
- **VoltAgent Integration** — Maps panel personas to 127+ VoltAgent specialist agents across 10 families (qa-sec, data-ai, infra, lang, domains, etc.) for deeper domain-specific reviews. Falls back to generic persona-prompted agents when VoltAgent isn't installed.
- Full mapping table for core personas, signal-detected specialists, and orchestration phases.
- Installation suggestion (once per session) when beneficial VoltAgent agents are missing.

## [2.8.0] — 2026-03-25

### Added
- **Review Mode Detection** — Auto-detects review mode from content type: Precise (code — requires line citations), Exhaustive (plans/docs), or Mixed. In Precise mode, findings without code citations cannot exceed P2.
- **Phase 4.55: Verification Command Execution** — Runs up to 5 read-only verification commands (grep/cat/head/tail/wc only) from P0/P1 findings. Annotates findings with [CMD_CONFIRMED], [CMD_CONTRADICTED] (demotes 1 level), [CMD_INCONCLUSIVE], or [CMD_FAILED]. Advisory, not gating.

## [2.7.0] — 2026-03-22

### Added
- **Phase 4.7: Severity Verification** — Dedicated agent reads the actual codebase to verify every P0 and P1 finding before the judge sees them. Classifies each as [EXISTING_DEFECT] or [PLAN_RISK]. P0 severity requires [EXISTING_DEFECT]; a [PLAN_RISK] is at most P1. Motivated by v2.6 benchmark where 2/3 P0 findings were overstated after code investigation.

## [2.6.0] — 2026-03-18

### Changed
- **References directory** — Domain checklists, prompt templates, and changelog extracted to `references/` files. SKILL.md reduced from 1,331 to 340 lines (75% token reduction) while preserving all review methodology.
- **Explicit negative scope** — "When NOT to Use" section prevents false triggers on single code reviews, bug fixes, deployment tasks, and skill improvement requests.
- **Structured domain checklists** — Specialist reviewers use explicit checklist format producing systematic assessments.

### Validated
- A/B tested against v2.5 on a 1,132-line ML pipeline plan. Both reached identical verdict (4/10, "Needs Significant Revision") with the same core findings. v2.6 showed marginal improvements in checklist discipline and judge output structure.

## [2.5.0] — 2026-03-15

### Added
- **Phase 4.6: Claim Verification** — Dedicated agent verifies every reviewer line-number citation against actual source. Classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE].
- **Epistemic labels** — Judge classifies every finding with confidence tags.
- **Scope & Limitations section** — Every report states what the panel cannot evaluate.
- **Correlated-bias disclaimer** — Flags when all reviewers converge (score spread < 2 points).

## [2.4.0] — 2026-03-12

### Added
- **Skill/Docs Portability signal group** — Auto-detects when reviewing skills or documentation claiming cross-platform applicability. Adds Portability Auditor with 7-item checklist. 9 signal groups total.

## [2.3.0] — 2026-03-08

### Added
- **Knowledge mining** — Mines feedback memories, project/global lessons, and skill insights before launching reviewers.
- **Built-in domain checklists** — 8 signal groups with pre-built review checklists.
- **Deep research mode** — Opt-in web research for domain best practices.
- 2 new signal groups: Cost/Billing and Data Pipeline/ETL (total: 8).

## [2.2.0] — 2026-03-05

### Added
- **Context gathering (Phase 1)** — Auto-scans sibling directories, traces imports/references, discovers existing safety mechanisms.
- **Reviewer suggestion qualifier** — Reviewers must state what safeguard would need to be absent.
- **Absent-safeguard check** — Judge verifies [CRITICAL] recommendations against existing safeguards.
- **Diverse reasoning strategies (DMAD)** — Each persona uses a different reasoning approach.
- **Anti-rhetoric guard** — Judge checks whether position changes were driven by evidence or eloquence.

## [2.1.0] — 2026-03-01

### Added
- **Auto-persona from content signals** — Keyword detection adds domain-specific reviewers up to 6 total.
- **Source-grounded debate** — Phase 3.5 summaries include inline code snippets for disputed points.

## [2.0.0] — 2026-02-25

### Added
- **Completeness Auditor** — Post-debate agent re-reads source line-by-line.
- **"New Discovery" requirement** — Each debate round requires agents to find at least one new issue.
- **Hybrid persona selection** — Mixed content always includes Code Quality Auditor.

### Fixed
- Discovery vs. argumentation problem from v1 — debate rounds no longer cause agents to stop finding new issues.

## [1.0.0] — 2026-02-15

### Added
- Initial release: multi-agent adversarial review with independent review, debate, and judge phases.
