# Changelog

## v2.6 (2026-03-25) — Efficiency & Composability
- **References directory** — signal detection tables, domain checklists, prompt templates, and changelog extracted to `references/`. SKILL.md reduced from 1,331 → 340 lines (75% token reduction).
- **Explicit negative scope** — "When NOT to Use" section prevents false triggers on single reviews, bug fixes, deployment tasks, skill improvement.
- **Input/dependency declarations** — explicit input spec, dependency on Agent tool + Opus model, version compatibility, handoff points to schliff and plan-review-integrator.
- **Structured examples** — two concrete input→output examples.
- **Schliff composite score:** 75.1 → 85.6 (+10.5). Structure 65→100, Composability 56→91, Efficiency 42→61.
- **A/B validated** — full panel run on same document (a university enrollment plan) produced identical verdict (4/10) with marginal improvements in checklist discipline (+2 findings) and judge structure (P0/P1/P2 tiers). See `docs/v25-vs-v26-comparison.md`.

## v2.5 (2026-03-20) — Trust & Verification Layer
- **Phase 4.6: Claim Verification** — new agent verifies all reviewer line-number citations against source. Classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE]. Inspired by SAFE pipeline.
- **Epistemic labels on all findings** — judge classifies every finding. Labels appear on action items so users know what to act on vs investigate.
- **"Scope & Limitations" section** — mandatory section stating what the panel cannot evaluate.
- **Correlated-bias disclaimer** — when score spread < 2 points, report notes unanimity may reflect shared model biases.
- **Updated judge prompt** — new Step 0 (Review Claim Verification) and Step 7 (Classify All Findings).
- Motivated by: applying AI Trust Evaluation Framework to the panel itself.

## v2.4 (2026-03-19)
- **New signal group: Skill/Docs Portability** — Portability Auditor persona (35% agreement). 9 signal groups total.

## v2.3 (2026-03-18)
- **Knowledge mining (Phase 1, Step 3.5)** — mines feedback memories, lessons, skill insights, CLAUDE.md.
- **Domain checklists** — built-in checklists for 8 signal groups. Auto-injected into persona prompts.
- **Deep research mode** — opt-in web research for domain best practices.
- **2 new signal groups** — Cost/Billing, Data Pipeline/ETL. 8 total.

## v2.2 (2026-03-18)
- **Diverse reasoning strategies** per persona (DMAD, ICLR 2025)
- **Anti-rhetoric guard** in judge prompt (ICML 2025)
- **Dynamic sycophancy intervention** (CONSENSAGENT, ACL 2025)
- **Judge confidence gating** (Trust or Escalate, ICLR 2025 Oral)
- **Context gathering (Phase 1)** — auto-scans for docs, imports, safety mechanisms
- **Absent-safeguard check** in judge prompt

## v2.1 (2026-03-17)
- Inline disputed snippets in summaries, auto-persona from content signals, prompt injection boundary, completeness auditor scope guidance

## v2 (2026-03-15)
- Completeness Auditor, hybrid personas, private reflection, agreement intensity, round summarization, conformity tracking

## Attribution

Based on: ChatEval (ICLR 2024), AutoGen, Du et al. (ICML 2024), MachineSoM (ACL 2024), DebateLLM, DMAD (ICLR 2025), "Talk Isn't Always Cheap" (ICML 2025), CONSENSAGENT (ACL 2025), Trust or Escalate (ICLR 2025 Oral).
