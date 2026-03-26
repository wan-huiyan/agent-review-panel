# Changelog

## v2.7 (2026-03-26) — Severity Verification & Defect Classification

Motivated by S57 benchmark: 2/3 P0 findings were overstated after code investigation.

- **Phase 4.7: Severity Verification** — new Opus agent reads actual code for every P0/P1 finding before the judge. Produces severity verification table with Verified/Not-a-bug/Downgraded verdicts.
- **`[EXISTING_DEFECT]` vs `[PLAN_RISK]` labels** — P0 requires `[EXISTING_DEFECT]` (with code evidence). `[PLAN_RISK]` caps at P1.
- **Expanded safety mechanism discovery** — added `DELETE FROM`, `MERGE`, `upsert`, `idempoten`, `--dry-run`, `duplicate`, `assertion` to grep patterns. Explicit instruction: when a finding claims "X is missing", verify by grepping.
- **`[UNCITED]` flag** — findings without specific line numbers are tagged for review.
- **Judge references verification table** — Step 0 updated to review both claim verification AND severity verification.

### v2.8 Roadmap (planned)

Based on deep research across 19 sources (see `references/research-v28.md`):

1. **Verify-before-claim with tool use** — agents include `verification_command` for P0/P1 findings; orchestrator runs grep/read before debate. (Tool-MAD 2026, CodeRabbit, Nexus)
2. **Three-tier finding classification** — Confirmed Defect (P0 eligible), Design Risk (caps at P2), Quality Concern (non-blocking). (Blincoe et al. IST 2022)
3. **Confidence scores (0-100) + diversity-aware retention** — agents emit calibrated confidence; debate amplifies dissenters over echoes. (ConfMAD EMNLP 2025, DAR March 2026)
4. **Precise/Exhaustive mode** — code reviews require concrete evidence; plan reviews allow broader risk. (Qodo 2.0, 60.1% F1)
5. **Severity-dampening judge prompt** — "What is the minimum severity justified by concrete evidence?" (Datadog FP filtering)
6. **Meta-Review "defend or retract" step** — agents explicitly defend or withdraw findings after cross-review. (adversarial-review repo)

New research foundations: ConfMAD (EMNLP 2025), DAR (March 2026), Tool-MAD (Jan 2026), Nexus (Oct 2025), CORE (Microsoft FSE 2024), SGCR (ASE 2025).

---

## v2.6 (2026-03-25) — Not separately released; folded into v2.7

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

v2.7+ also informed by: ConfMAD (EMNLP 2025), DAR (March 2026), Tool-MAD (Jan 2026), Nexus (Oct 2025), CORE (Microsoft FSE 2024), SGCR (ASE 2025), Qodo 2.0 benchmark, CodeRabbit AST-grep agent, adversarial-review repo, Hegelion, Block g3, InfCode.
