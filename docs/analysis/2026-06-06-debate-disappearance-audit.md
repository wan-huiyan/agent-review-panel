# Why the review agents stopped debating — 7-day usage audit

**Date:** 2026-06-06 · **Method:** multi-agent Workflow audit (22 candidate sessions → 18 classified, 4 dropped on schema-validation failure) over local Claude Code session transcripts, June 1–6 2026. Classifier = one grep-guided agent per transcript; aggregation deterministic; synthesis written by the orchestrator.

> **Privacy note:** this audit ran over real client/work sessions. All client and project identities are anonymized here as **Project A/B/C** by *work type* (the type is what the finding depends on; the identity is not). No client names, repo/PR identifiers, or implementation specifics are retained.

## Answer in one sentence

The debate phase isn't broken — it's **opt-out-by-default now**: across 51 real review runs in the last 7 days, **50 ran with no debate and exactly 1 debated**, because an autonomous / ultracode / multi-PR working style routes reviews into three debate-less execution paths (parallel-streamlined skill, generic find→verify→judge Workflow, and — most surprisingly — the full skill invoked but silently collapsed).

## What the 7 days actually show (51 runs, 18 sessions)

| Execution path | Runs | Debates? |
|---|---:|---|
| `parallel-panel-streamlined-no-debate` | 21 (41%) | no by design |
| `generic-workflow-find-verify-judge` (Workflow tool) | 17 (33%) | no by design ← **the "review → verify → judge, 3 stages"** |
| `other` (design-scope w/ adversarial-verify sub-phase) | 5 | no |
| `code-review` (single agent) | 4 | no |
| `single-agent-multi-persona` | 2 | no |
| `full-agent-review-panel` | 2 | **1 yes, 1 no** |

- **Debate present: 50 `no` / 1 `yes`.** (98% debate-free.)
- **Ran as:** workflow 20 · skill 13 · inline-agents 10 · single-agent 8.
- **Trigger:** autonomous 31 · user-requested 20.
- **By work type (clear pattern):**
  - **Project A — autonomous UI multi-PR work** → almost all `parallel-panel-streamlined-no-debate` (exactly what that skill was built for: small PRs, multi-PR time budget).
  - **Project B — security-sensitive data-handling work** → almost all `generic-workflow-find-verify-judge` run via the Workflow tool under ultracode.
  - **Project C — internal tooling** → `generic-workflow-find-verify-judge`.

**The lone debate (an internal ecosystem/portfolio review):** run as a Workflow whose script *explicitly authored a `Debate` phase* (`phases [Review, Debate, Audit+Verify, Judge]`, a dedicated debate agent ran). Proof that debate *can* live in a workflow — it just isn't the default shape.

## Root cause — three triggers, ranked by frequency

**(1) Streamlined/parallel skills auto-selected for autonomous multi-PR work — 23/51 (~45%).**
`parallel-panel-streamlined-no-debate` (created 2026-05-26) and `single-agent-multi-persona-review` (2026-05-11) were built to skip debate/judge to save wall-clock on small PRs and 2+-PR autonomous runs. Project A's UI marathons hit this path every time. *Working as designed* — but the design is debate-less.

**(2) Reviews run as Workflows (find→verify→judge) — 17/51 (~33%).**
This is the **structural** one and the source of the "3 stages" observation. Debate is a **sequential, stateful cross-talk** process (reviewers read each other across rounds). The Workflow/ultracode engine is a **parallel fan-out** engine (`parallel()`/`pipeline()` — agents never see each other). The Workflow tool's own canonical review recipe is literally **"find → adversarially verify → judge"** — there is no debate primitive. So "review this in ultracode" → a workflow → debate structurally cannot appear. The judge ends up doing alone the reconciliation debate was meant to do. (Project B's security-gated data-exposure reviews all run this way — ironically the highest-value place for debate.)

**(3) The full skill invoked but debate silently skipped — the surprising one.**
`ran_as: skill` shows up **13 times**, but only **2** runs executed as the full panel and only **1** debated. So invoking `/agent-review-panel` did **not** reliably produce the Phase 5–7 debate. Confirmed example — **Project B, a security-sensitive SQL-validation PR that gates data exposure:** the skill launched, ran 5 Phase-3 reviewer agents + 1 Phase-8 audit agent, then **jumped straight to judge — Phases 5/6/7 (debate, summarize, blind-final) never ran.** This is silent phase compression / reinterpretation: the skill launches, independent reviews + audit happen, then it skips debate. The v3.1 `state/` files + Phase 13.5 gate were meant to catch exactly this — but they don't fire when the "skill" is actually executing as an inline/workflow shape rather than the literal Phase 1→16 protocol.

**Net:** (1)+(2) ≈ 78% are debate-free *by design* (a fast mode was chosen, knowingly or not). (3) is the one to worry about — you think you're getting a debate panel and you're not.

## How to get debate back

**To force a real debate panel right now:**
- Invoke the skill **without** ultracode/workflow framing. Say *"run the **full** agent-review-panel with adversarial debate rounds — do not streamline, do not run it as a workflow"*, or `/roundtable:agent-review-panel` in a non-ultracode turn. Ultracode biases the harness toward authoring a (debate-less) Workflow; debate lives in the **skill's Agent-tool orchestration**, not the Workflow engine.
- For security / data-gating go/no-go decisions, debate is **highest-value exactly there** — "is this bypass real / is P0 justified" is an adversarial tradeoff. Those are currently running as find→verify→judge. Prefer the full panel for high-stakes gating calls.

**Pick the mode deliberately (the spectrum):**
| Want | Use |
|---|---|
| Fast eyes on a tiny PR | `code-review` / `single-agent-multi-persona` |
| Independent parallel lenses, small PR, autonomous run | `parallel-panel-streamlined-no-debate` |
| **Adversarial tradeoff, high-stakes, debate changes the verdict** | **`roundtable:agent-review-panel` (full) — invoked as a skill, not a workflow** |

**Durable guardrails (recommend adding to the skill — tracked in issue):**
1. **Debate-skip must be loud, not silent.** When the panel runs but Phase 5 produced no `reviewer_*_phase_5_round1.md` state files, the report should carry a `[NO-DEBATE]` / `[COMPRESSED]` banner (the machinery exists for compression; extend it to debate-absence). You'd see this instead of having to ask.
2. **If you want debate inside a Workflow, author a `Debate` phase explicitly** — the lone debating run proves it works (`phases [Review, Debate, Audit+Verify, Judge]`). A canonical "debate-in-workflow" snippet (round 1 reviewers → each reads peers' findings → round 2 rebuttal → judge) could be added to the skill as the ultracode-mode recipe.
3. **Treat "invoke skill" ≠ "ran protocol."** A one-line post-run assertion (did Phase 5 outputs exist?) closes trigger (3).

## The irony (and the real lesson)

This audit itself ran as a **parallel fan-out with no debate** — 22 classifiers, no cross-talk, then synthesis. And that was **correct**: the transcripts are independent; there's no adversarial tradeoff for two classifiers to argue over. That's the discriminator to keep: **fan-out (no debate) is right when the sub-tasks are independent; debate is worth its cost only when reviewers would genuinely change each other's verdicts** (security vs perf, correctness vs readability, is-this-P0-real). High-stakes gating reviews are squarely in the debate-worthy column and are the ones currently missing it.

## Confidence & gaps

- **High confidence** on the headline (50/51 no-debate) — it's a direct count over classified runs, and the dominant paths are debate-less *by construction*, not by classifier judgment.
- **Sample:** 18 of 22 review-signal-ranked sessions (4 dropped on schema-validation failure across Projects A & B — re-runnable). The 22 were the top review-signal sessions out of ~1600 7-day transcripts; low-signal sessions (no review activity) were correctly excluded, but a debate-having run in an unsampled session is possible (would only move the ratio slightly).
- **Trigger-(3) frequency** (skill-invoked-but-no-debate) is the least precise number — the `ran_as: skill` (13) vs `full-panel` (2) gap is strong directional evidence but the classifier can't always distinguish "skill compiled to workflow" from "skill ran partially." Worth a targeted re-read of the 13 skill-invocation spans for an exact count.
