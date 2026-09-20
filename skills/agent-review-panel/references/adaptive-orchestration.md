# Adaptive orchestration contract (v4 draft)

This reference is intentionally separate from the current v3.9.1 full protocol.
It defines a proposed adaptive control layer to be evaluated in shadow mode before
any default behavior changes.

## Invariants

1. The current full panel remains available and authoritative for explicit full/high-stakes requests.
2. Adaptive routing chooses *what expensive reasoning happens next*; it never establishes truth.
3. User-explicit modes, personas, exhaustive trace, deep research, multi-run, or full-panel requests are floors.
4. Mandatory evidence rules from v3.9.1 cannot be weakened by Jev or by cost pressure.
5. Blocked/missing reviewers are missing evidence, never clean consensus.
6. Same-artifact consensus remains one source.
7. Live-state P0 claims still require live evidence.
8. A judge-less run must not claim a Supreme Judge verdict.
9. Intentional evidence-backed debate omission is `[DEBATE-NOT-NEEDED]`; accidental/unavailable debate remains `[NO-DEBATE]`.
10. Router/provider failure falls back to a declared deterministic path, never a silent partial full-panel run.

## Adaptive decision points

### Reviewer-set selection

Candidate generation stays deterministic using the existing signal and persona tables.
Optional bounded ranking may choose among candidates, but:
- retain every user-explicit persona;
- target 2–3 materially non-overlapping perspectives by default;
- add a domain specialist when a strong signal exists;
- uncertainty falls back to deterministic personas.

### Pre-debate classification

Normalize compact finding records:
- finding ID;
- claim type;
- proposed severity;
- evidence source(s);
- source independence;
- confidence;
- falsification observation;
- verification status.

Do not merge away distinct evidence, severity disagreement, or dissent.

### Verify before debate

Route cheap factual disagreements to allowed read-only evidence checks before sending
reviewers into adversarial discussion.

Examples:
- missing guard/class/constant -> grep/read;
- stale-branch absence -> compare current branch/default branch;
- live-state claim -> live describe/show if available, otherwise STATIC-INFERENCE;
- external product/regulatory fact -> authoritative-source verification;
- architectural judgment/trade-off -> discussion may still be appropriate.

### Debate gate

Possible outcomes:
- `DEBATE_NOT_NEEDED`: no material unresolved disagreement after evidence checks;
- `VERIFY_FIRST`: factual dispute has a cheaper evidence path;
- `DEBATE_ONE_ROUND`: material judgment/trade-off remains;
- `ESCALATE_FULL`: explicit full request or high-impact uncertainty warrants current protocol;
- `UNAVAILABLE`: debate mechanism unavailable; preserve current lower-confidence NO-DEBATE semantics.

Adaptive one-round debate is followed by a new stop/verify decision. Further rounds require
new evidence or a still-material disagreement. Three rounds remain a full-mode capability.

### Verification tier

Start from deterministic floors:
- Light: simple local fact;
- Standard: cross-file/static semantics;
- Deep: external/runtime/novel domain or major unresolved trade-off.

Optional bounded ranking can refine within policy. It cannot downgrade below the evidence floor.

### Judge gate

Use a judge only when:
- a material recommendation/severity/trade-off remains unresolved;
- user explicitly asks for adjudication/full protocol;
- high-impact uncertainty remains after verification;
- adaptive policy explicitly escalates.

Otherwise report an Adaptive Review Outcome with evidence/provenance and no fake judge verdict.

## Jev integration

Use the shared provider/runtime proposed in memory-hygiene#12 and consumed by
agent-traffic-control#71. Do not create a second transport implementation or another skill.

Candidate bounded questions include:
- which candidate personas are materially non-overlapping for this task?
- are two compact findings likely the same issue?
- after verification, is this still a substantive disagreement?
- is direct verification preferable to another debate round?
- which of Light/Standard/Deep is appropriate, subject to deterministic floors?
- is another expensive review step likely to add decision-relevant information?

Jev must not decide truth, severity correctness, shipping safety, live state, or whether
mandatory verification can be skipped.

## Shadow record

Every decision should be serializable without raw private work content:

```json
{
  "mode": "shadow",
  "policy_version": "adaptive-v4-draft-1",
  "selected_personas": ["..."],
  "finding_count": 0,
  "debate_decision": "VERIFY_FIRST",
  "verification_tiers": {"F1": "LIGHT"},
  "judge_needed": false,
  "full_escalation": false,
  "provider": {"status": "not_requested"},
  "cost_observed": null
}
```

Do not infer token savings from this record. The host evaluation harness must attach actual usage.

## Reporting semantics

- `[ADAPTIVE]`: adaptive orchestration was used.
- `[DEBATE-NOT-NEEDED]`: debate deliberately skipped after evidence-aware convergence.
- `[DEBATE-DEFERRED-TO-VERIFICATION]`: direct evidence was preferred to rhetoric.
- `[ESCALATED-FULL]`: adaptive path handed off to the current full protocol.
- `[NO-DEBATE]`: debate was required/expected but unavailable or accidentally omitted.
- `[COMPRESSED]`, `[LIVE-VERIFIED]`, `[STATIC-INFERENCE]`, verification labels, and BLOCKED handling keep their current meanings.

This distinction is load-bearing: a successful adaptive stop must not be reported as a protocol failure.
