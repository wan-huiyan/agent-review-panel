# Evaluating `agency-agents` as a supplement to VoltAgent for the review panel

**Date:** 2026-06-08 · **Question:** Should we wire
[`msitarzewski/agency-agents`](https://github.com/msitarzewski/agency-agents)
into `agent-review-panel` alongside the existing VoltAgent integration to improve
the skill? · **Method:** repo + API inspection, cross-referenced against the
2026-06-06 debate-disappearance audit and the v2.9/v3.4 VoltAgent integration.

## Verdict in one line

**No — don't bolt the catalog on.** `agency-agents` is a real, well-built, actively
maintained repo, but it's *breadth-of-personas-for-an-agency*, not
*depth-of-reviewers*, and it doesn't move the levers that actually limit the
panel's quality today. If curious, the low-commitment test is to cherry-pick **one**
genuinely-additive reviewer persona for a domain we actually review and A/B it on a
single real run.

## What `agency-agents` actually is (verified)

| Fact | Value (GitHub API, 2026-06-08) |
|---|---|
| Stars | 108,251 |
| Forks | 17,839 |
| Fork of another repo? | No (original) |
| Created | 2025-10-13 |
| Last push | 2026-06-07 (active) |
| License | MIT |

- **232 agent personas across 16 divisions.** Heavily weighted toward
  **marketing (47), specialized (61), game dev (30+), GIS (14), security (12)**,
  plus sales, paid media, product, finance, academic, spatial computing.
- Personas are **personality-forward** and tuned to **produce / build / promote / sell**
  (e.g. "growth hacker", "brand guardian", "whimsy injector", "reality checker").
- Stored as markdown with structured sections; a `convert.sh` step generates
  tool-specific formats; `install.sh` copies them into `~/.claude/agents/` (and
  Copilot/Cursor dirs). Once installed they **are** addressable via `subagent_type`
  by name.

## Why it doesn't move our quality levers

The 2026-06-06 usage audit (`docs/analysis/2026-06-06-debate-disappearance-audit.md`)
established that the panel's real quality gaps are **debate disappearance**
(50/51 runs ran with no debate), **judge hallucination** (Supreme Judge inventing
P0s — the v3.2.0 Phase 14.5 motivation), and **HTML rendering** drift. None of those
are "we don't have enough reviewer personas." Adding a second 232-agent source
touches debate presence, judge grounding, and rendering **not at all**.

### 1. Breadth-for-an-agency, not depth-of-reviewers

VoltAgent's value to us is concentrated in its `qa-sec` family —
`code-reviewer`, `architect-reviewer`, `security-auditor`, `penetration-tester`,
`qa-expert`, `chaos-engineer` — agents **purpose-built to find flaws**, which is
exactly what an adversarial panel needs. `agency-agents`' overlap there (its
Testing/Security divisions) is redundant with what we already map; its *additive*
mass is build/market/sell personas, the wrong shape for a reviewer slot.

### 2. The footgun (the real reason to hold off)

`agency-agents` personas ship their own frontmatter — a **model** and a
**build/market/sell-oriented system prompt**:

- **Cheerleading, not red-teaming.** A "growth hacker" or "brand guardian" dropped
  into a reviewer slot produces advocacy, not critique — directly undermining the
  adversarial-debate thesis we just shipped guardrails for in #57 (v3.5.0).
- **Model fall-through at scale.** Per the v2.14 lesson, loose `subagent_type`
  launches silently inherit the frontmatter model default unless every launch forces
  `model: "opus"`. We'd inherit that risk 232×.
- **A second catalog to maintain.** We'd own a `convert.sh` step, flat-namespace
  collisions in `~/.claude/agents/`, and a *second* vendored catalog to drift-check
  alongside the VoltAgent one already gated in CI (`voltagent-catalog-check.sh`,
  `release-check.sh` §8).

### 3. The additive slice is speculative for how we actually use the panel

`agency-agents` *would* extend us into domains VoltAgent is thin on — marketing copy,
game design, GIS, brand voice, academic world-building. But **every run in the audit
is an engineering artifact** (READMEs, code, plans). So that additive slice is
hypothetical for today's usage, not a gap we're hitting.

## If we still want to test it

Lowest-commitment experiment: install **one** genuinely-additive *reviewer*-flavored
persona locally (e.g. an accessibility auditor, or a domain we actually review), A/B
it against the current panel on a single real run, and keep it only if it surfaces
something VoltAgent's `qa-sec` family didn't. One run, not a maintenance commitment.

## Recommended next work (deferred to future sessions)

The conversation that produced this evaluation reaffirmed where "improve the skill"
actually pays off: the two shipped guardrails for the audit's findings each have a
clear next increment, and they **share a root cause**.

> **Shared root cause:** both terminal gates fire only on the *literal Phase 1→16
> protocol*. On the inline / Workflow / ultracode execution shapes — the same shapes
> the audit found silently skipping debate — these gates likely don't run either.
> v3.5.0 fixed this for the NO-DEBATE banner by anchoring detection at the **Phase
> 15.1 report-write chokepoint** (terminal; every completed run passes it). The same
> move generalizes.

### A. Debate-presence guardrail — next increment (on v3.5.0 / #57)

v3.5.0 makes debate-skip *loud* (`[NO-DEBATE]` banner + confidence cap) but does not
*restore* debate on the debate-less shapes. Candidates:

1. **Ship the "debate-in-Workflow" recipe as a reusable primitive**, not just prose —
   round 1 reviewers → each reads peers' findings → round 2 rebuttal → judge. The lone
   debating run in the audit proves a Workflow *can* debate; make it the cheap default
   for ultracode reviews.
2. **Tighten trigger-(3) precision.** The audit flagged `ran_as: skill` (13) vs
   full-panel (2) as its least-precise number. A targeted re-read of the 13
   skill-invocation spans (or a runtime assertion distinguishing "skill compiled to
   workflow" from "skill ran partially") would harden the count and the detector.
3. **Auto-route high-stakes / security-gating reviews to the full debate panel**
   rather than find→verify→judge — that's the debate-worthy column the audit showed
   is currently missing it.

### B. Judge-grounding step — next increment (on v3.2.0 Phase 14.5)

Phase 14.5 already re-verifies judge-introduced P0/P1 against ground truth — but it
fires only on the literal protocol. On the inline/workflow shapes (where debate is
also absent) the judge does the reconciliation **solo**, which is exactly when
judge-introduced findings most need grounding and least get it. Candidates:

1. **Anchor judge-output verification at a terminal chokepoint** (mirror what v3.5.0
   did for NO-DEBATE at Phase 15.1) so Phase 14.5 can't be skipped by execution shape.
2. **Couple the two gates:** when a review runs find→verify→judge with no debate, the
   solo judge is the highest-risk configuration — flag it and force the judge-grounding
   re-check there.

> These are enhancements on shipped guardrails, not greenfield. Filing them as GitHub
> issues (the repo's established follow-up mechanism, auto-surfaced by `session-handoff`)
> is the natural next step once we decide to pick them up.

## Sources

- Repo: https://github.com/msitarzewski/agency-agents · API:
  https://api.github.com/repos/msitarzewski/agency-agents (figures verified 2026-06-08)
- `docs/analysis/2026-06-06-debate-disappearance-audit.md`
- VoltAgent integration: `skills/agent-review-panel/SKILL.md` ("VoltAgent Integration",
  v2.9 / expanded v3.4.0), `references/voltagent-catalog.json`
- Memory: `feedback_force_opus_subagent_type.md` (v2.14),
  `feedback_judge_can_hallucinate_p0s.md`, `project_debate_opt_out_by_default.md`
