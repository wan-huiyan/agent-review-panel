# Where a full panel run's tokens actually go (2026-07-16 audit)

**Question:** the panel is expensive — which phase should a budget mode cut?
**Method:** parsed the Claude Code transcripts (main session + all
`subagents/agent-*.jsonl`, usage deduped by assistant-message id) of one real
**full-protocol** run — all phases including a debate round — executed
2026-07-02 against a production client repository (identifiers withheld).
Prices: Fable 5 $10/$50 per Mtok (cache write 1.25×, cache read 0.1×),
Opus 4.8 $5/$25, Sonnet 5 $3/$15, Haiku 4.5 $1/$5.

## Headline: the orchestrator, not the reviewers

Total run cost: **$162.01**. Split by agent:

| Component | Cost | Share | Notes |
|---|---|---|---|
| **Main session (orchestrator)** | **$111.49** | **69%** | Fable 5 main loop; 157 assistant turns; context grew 270k → 630k tokens with no compaction; 58.75M cumulative cache-read tokens |
| Supreme Judge — ran twice | $13.53 | 8% | $11.49 (Fable pass) + $2.04 (Opus advisory pass) |
| P14.5 judge-output verification agent | $4.77 | 3% | |
| HTML report agent (P15.3) | $6.50 | 4% | 75k output tokens; plus a large share of the orchestrator's late-session turns were spent driving it |
| 4 reviewers, Phases 3–7 | $11.86 | 7% | Devil's Advocate $5.41, Feasibility $2.90, Risk $2.38, Stakeholder $1.17 |
| Verification agents (P8, P10, P11 + ad-hoc verify) | $10.98 | 7% | Four separate agent spin-ups |
| Misc (inventory, PR review, etc.) | ~$2.9 | 2% | |

Uncached input across everything was only 0.37M tokens; the bill is
**cache reads (79.7M)**, cache writes (6.5M), and output (0.68M).

## Why the orchestrator dominates

- The panel **started at a 270k-token context baseline** (prior session
  work). Every one of the subsequent 157 orchestrator turns re-paid that
  baseline — and everything the panel added — as cache reads.
- Context grew monotonically 270k → 630k. The marginal cost of an
  orchestrator turn is `context × cache-read price`; late turns cost ~6×
  early ones.
- The state-file discipline (v3.1.0: agents return path + 100-word summary)
  was **already active** — the bloat is not verbatim report text, it is
  turn count × context size × main-loop model price.
- Attributed by timeline: the phase-3–14.5 coordination itself cost the
  orchestrator only ~$13; the pre-panel baseline ($15), the Phase 15.x
  report-driving stretch (~$60), and post-panel follow-ups (~$23) did the
  damage.

## What this refutes

The intuitive cost model — "N opus reviewers reading the artifact dominate,
so swap them to cheaper models" — is wrong for this skill. All four
reviewers combined were 7% of the run. Model-tiering the reviewers to
sonnet saves ~$5 of $162; cutting orchestrator turns and context saves
tens of dollars.

## Countermeasures shipped as Budget Mode (v3.7.0)

In measured order of impact:

1. **Orchestrator turn diet** (69% driver): batched launches, persistent
   reviewers via SendMessage, ≤50-word agent returns, no inter-phase
   narration, ≤25-turn target, fresh-session guidance when the conversation
   already carries heavy context.
2. **Single judge pass** ($18 driver): one opus judge; P14.5 becomes an
   orchestrator grep-check (protection kept, agent spin-up removed).
3. **Markdown-only output** ($7 + driving-turns driver): 15.2/15.3 offered
   post-hoc — their agents read state files from disk, so nothing is lost.
4. **Consolidated verification** ($11 driver): Phases 8+10+11 in ONE sonnet
   agent.
5. **Model tiering** (smallest lever, kept honest): reviewers/verifier
   sonnet, judge opus, model always explicit.

Estimated budget-mode cost for the same review: **$25–40 (~75–80% less)**.

## Reproduction

The parser (dedupe by message id, per-agent totals from
`subagents/agent-*.meta.json` labels, per-phase timeline from content
markers) is ~120 lines of Python over the session's `.jsonl` transcripts.
Re-run it against any panel session directory under `~/.claude/projects/`.
