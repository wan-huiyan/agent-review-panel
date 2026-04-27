> ⚠️ **COMPRESSED RUN — Phases skipped: 4 (security), 5 (security, devils-advocate), 7 (architecture)**
>
> This run did not complete the full panel protocol. The Supreme Judge ruled on partial input. Findings below should be treated as **lower confidence** than a full-run report. Re-run the panel for a complete review.

# Review Panel Report
**Work reviewed:** PR #999 — example compressed run  |  **Date:** 2026-04-27
**Panel:** 5 reviewers + Auditor + Judge
**Verdict:** Needs significant revision  |  **Confidence:** Low
**Auto-detected signals:** test-fixture
**Review mode:** Mixed (compressed)

## Executive Summary
This is a synthetic fixture demonstrating the COMPRESSED RUN warning pattern. The panel ran with Phases 4, 5 (rounds), and 7 partially missing for 3 reviewers. The judge ruled on partial input. Findings are flagged with `[COMPRESSED]` suffix.

⚠️ HUMAN REVIEW RECOMMENDED: Compressed run with low confidence. A human should validate findings before acting on them.

## Scope & Limitations
Reviewed: synthetic test fixture. Not a real review.
Structural limitation: this run skipped MANDATORY phases (4, 5, 7) for some reviewers — see the COMPRESSED RUN warning above.
Epistemic labels: [VERIFIED] [CONSENSUS] [SINGLE-SOURCE] [UNVERIFIED] [DISPUTED]
Defect type labels: [EXISTING_DEFECT] (bug in current code) [PLAN_RISK] (risk if plan is implemented as written)

## Score Summary
| Reviewer | Persona | Intensity | Initial | Final | Recommendation |
|----------|---------|-----------|---------|-------|----------------|
| Reviewer 1 | Architecture Critic | 50% | 5/10 | 5/10 | Needs significant revision |
| Reviewer 2 | Security Auditor | 30% | 5/10 | 6/10 | Needs significant revision |
| Reviewer 3 | SRE | 30% | 4/10 | 5/10 | Needs significant revision |
| Reviewer 4 | Correctness Hawk | 30% | 6/10 | 6/10 | Accept with minor changes |
| Reviewer 5 | Devil's Advocate | 20% | 5/10 | 5/10 | Needs significant revision |

## Consensus Points
- Example consensus point [CONSENSUS] [COMPRESSED]

## Disagreement Points (with judge rulings)
- Example disagreement [SINGLE-SOURCE] [COMPRESSED]

## Completeness Audit Findings
Synthetic — limited audit due to compressed run.

## Action Items (with severity AND epistemic labels)
1. **[P1] [VERIFIED] [COMPRESSED]** Example action — re-run the panel with full protocol
2. **[P2] [CONSENSUS] [COMPRESSED]** Example action — review compressed-run findings manually

## Detailed Reviews (collapsible sections)

<details><summary>Architecture review</summary>Synthetic.</details>
