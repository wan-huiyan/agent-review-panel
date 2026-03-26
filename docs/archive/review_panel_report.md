# Review Panel Report
**Work reviewed:** v2.8 Roadmap (references/research-v28.md) | **Date:** 2026-03-26
**Panel:** 4 reviewers + Supreme Judge | **Verdict:** Ship 3 of 6, add 1 new mechanism
**Confidence:** High

## Executive Summary

The v2.8 roadmap correctly targets the two biggest observed problems (severity inflation, domain context blindness) with well-researched proposals backed by 19 sources. However, the panel found that **shipping all 6 proposals would over-engineer the solution** — six interacting mechanisms for two complaints creates combinatorial complexity, token budget compounding (105-130k estimated), and a critical **systematic false-negative risk** where every proposed change suppresses findings with no corresponding upward pressure. Score: **5/10**.

**Recommendation:** Ship 3 proposals + 1 new coverage check mechanism. Defer 3 proposals to v2.9.

## Score Summary

| Reviewer | Persona | Intensity | Score | Key Position |
|----------|---------|-----------|-------|-------------|
| Feasibility Analyst | Feasibility | 60% | 7/10 | Most proposals feasible; token compounding is binding constraint |
| Stakeholder Advocate | User Impact | 50% | 6/10 | Ship 3 not 6; over-engineered for two user complaints |
| Risk Assessor | Failure Modes | 30% | 4/10 | Systematic false-negative blindness; all changes push downward |
| Devil's Advocate | Challenge All | 20% | 3/10 | Complexity ratchet; try prompt-only first |
| **Supreme Judge** | **Synthesis** | — | **5/10** | **Ship #1, #4, #5 + new coverage check. Defer #2, #3, #6.** |

## Consensus Points

1. **Proposal #3 (confidence scores 0-100) is problematic** — LLMs are poorly calibrated on numeric self-assessment. All reviewers oppose user-facing confidence numbers.
2. **Roadmap is overscoped** — 3/4 reviewers recommend shipping fewer than 6 proposals.
3. **Proposal #5 (severity-dampening judge) has highest value-to-cost ratio** — prompt edit, zero latency, directly targets 2/3 P0 overstatement rate.
4. **Token budget is binding** — combined proposals could push from 75k to 130k tokens, leaving thin margin for large PRs.

## Disagreement Points (with Judge Rulings)

### Is verify-before-claim (#1) essential or over-engineered?
- **DA:** Try prompt-only first ("cite line numbers or retract")
- **Feasibility + Stakeholder:** Ship it, it's the cornerstone
- **Judge ruling:** **Ship #1, but make verification advisory, not gating.** Prompt instructions cannot reliably prevent LLM confabulation; structural verification can. But grep failure ≠ disproof. Failed verification should demote and annotate, not delete.

### Does double suppression (#2 + #5) create systematic under-reporting?
- **Risk Assessor:** Yes — tier caps + dampening judge = one-way ratchet downward
- **Others:** Acknowledge but don't elevate
- **Judge ruling:** **Risk Assessor is substantially correct.** This is the most important finding. Every single proposal applies downward pressure. No proposal provides upward pressure. Shipping must include a coverage check mechanism.

### Should #6 (defend/retract) ship as standalone?
- **Feasibility:** High token cost (16-42k additional)
- **Risk Assessor:** Creates commitment bias
- **DA:** Unnecessary complexity
- **Judge ruling:** **Do not ship #6 as standalone.** Fold the useful part into the judge step: "For findings that received counter-arguments, state whether the claim survives." Zero additional agent calls.

## What to Ship in v2.8

| Priority | Proposal | How | Token Impact |
|----------|----------|-----|-------------|
| **P0** | #5 Severity-dampening judge | Prompt edit to existing judge step | ~0 |
| **P0** | Coverage check (NEW) | Judge sub-step: "Are there unexamined risk categories?" | ~500 tokens |
| **P1** | #1 Verify-before-claim | Advisory mode. Orchestrator runs grep/read for P0/P1, annotates results. Max 5 verifications. | +5-10k tokens |
| **P1** | #4 Auto-detected mode | Auto-select Precise (code) vs Exhaustive (plans) from input type. No user toggle. | ~0 (redistributes) |

**Estimated total: ~80-85k tokens** (within budget)

## Deferred to v2.9

| Proposal | Reason |
|----------|--------|
| #2 Three-tier classification | Double-suppression risk with #5. Reassess after measuring #5's impact. Merge the useful P0-requires-evidence constraint into #1 instead. |
| #3 Confidence scores | No reviewer supports user-facing numbers. If needed internally, implement as hidden metadata. |
| #6 Defend/retract | Fold into judge step (zero cost). Don't build standalone mechanism. |

## Critical Finding: False-Negative Blindness

The Risk Assessor identified that **all 6 proposals push findings downward with no upward pressure**. This creates an invisible failure mode: the panel looks cleaner but potentially misses more real issues. False positives are visible (user complains). False negatives are invisible (user never knows).

**Required mitigation (the coverage check):** After all verification, the judge must ask: "Given these file changes, are there risk categories (security, error handling, race conditions, API contracts) that no reviewer examined?" This is cheap (~500 tokens) and directly counterbalances the suppression stack.

## Action Items

1. **[P0] Ship #5 as prompt edit today.** A/B test on 3 repos. Measure severity distribution shift.
2. **[P0] Design coverage check sub-step.** Add to judge prompt. This was NOT in the original roadmap — the panel surfaced it.
3. **[P1] Build #1 in advisory mode.** Track verification false-negative rate to calibrate future gating decisions.
4. **[P1] Ship #4 as auto-detected behavior.** Low risk, parallel with above.
5. **[P2] Establish phase-count budget rule.** v2.8 must not exceed v2.7's phase count.
6. **[P2] After v2.8 ships, measure finding volume vs v2.7 baseline.** If mean findings drop >20%, suppression is too aggressive.
7. **[P3] Add "Top 3 Actions" header to report.** Zero-cost formatting change that addresses "report is long" feedback. (Stakeholder Advocate suggestion)

## Meta-Observation

The most valuable insight came from the lowest-scoring reviewer (Risk Assessor, 4/10) — not the most favorable one. The false-negative blindness concern was missed by reviewers who focused on feasibility and user impact. This validates the skill's own design philosophy: adversarial review surfaces things aligned review does not.

---

<details>
<summary>Full Reviewer Transcripts</summary>

### Feasibility Analyst (7/10)
[See Phase 2 output — per-proposal feasibility, token estimates, complexity ratings]

### Stakeholder Advocate (6/10)
[See Phase 2 output — per-proposal user impact, "ship 3 not 6" recommendation]

### Risk Assessor (4/10)
[See Phase 2 output — per-proposal failure modes, false-negative blindness analysis]

### Devil's Advocate (3/10)
[See Phase 2 output — counter-arguments, complexity trajectory, prompt-only alternatives]

</details>
