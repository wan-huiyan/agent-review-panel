# Agent Review Panel — Research Roadmap

A living document mapping academic research and open-source projects to skill features. Organized by adoption status.

---

## Already Incorporated (v1–v2.15)

These foundations form the core architecture. Research adopted in v1–v2.5; structural optimisation in v2.6; verification round in v2.11; triple output + persona profiles in v2.12–v2.13; Data Flow Trace + Multi-Run Union + Force Opus in v2.14; expandable issue cards in v2.15.

| Source | What We Took | Version |
|--------|-------------|---------|
| **ChatEval** (thunlp/ChatEval, ICLR 2024) | Blind final judgment, persona system, anti-groupthink | v1 |
| **AutoGen** (microsoft/autogen) | Solver/aggregator architecture, sparse topology, round management | v1 |
| **Du et al.** (ICML 2024) | Cross-verification for factuality, debate-improves-accuracy thesis | v1 |
| **MachineSoM** (zjunlp/MachineSoM, ACL 2024) | Private reflection rounds, conformity tracking (tf/ft/tt/ff) | v2 |
| **DebateLLM** (instadeepai/DebateLLM) | Agreement intensity modulation, round summarization, judge-mediated convergence | v2 |
| **MiroFish** ([666ghj/MiroFish](https://github.com/666ghj/MiroFish)) | Heterogeneous agent personalities matched to task characteristics; influenced auto-persona detection (v2.1) and persona-matched verification agents (v2.11) | v2.1, v2.11 |
| **Meta Agentic Code Reasoning** (arXiv:2603.01896, 2026) | Semi-formal certificate prompting — INPUT_SCHEMA → TRANSFORM → OUTPUT_SCHEMA → COMPOSITION_CHECK per function; 78%→93% accuracy gain. Adopted as the core reasoning template for the Phase 2 Data Flow Tracer. | v2.14 |
| **LLMDFA** (NeurIPS 2024) | Few-shot chain-of-thought dataflow facts per function, then compose across call graph. Adopted as the mental model for tier-based path traversal in Phase 2. | v2.14 |
| **RepoAudit** (ICML 2025) | Demand-driven exploration with memory — fetch function definitions only when encountered on the path. Informs Phase 2's orchestrator path-ranking heuristic. | v2.14 |
| **BugLens** (ASE 2025) | Static-analyzer-plus-LLM pattern: use high-recall candidate finder first, then LLM for feasibility validation (7x false positive reduction). Informs Phase 2 violation flagging → Phase 3 reviewer validation. | v2.14 |
| **ZeroFalse** (arXiv:2510.02534, 2025) | Domain-specialized prompting with dynamic path reconstruction (F1 0.955). Informs the Phase 2 per-function certificate structure. | v2.14 |

### Key findings from each

**ChatEval:** Three communication strategies tested (One-By-One, Simultaneous-Talk, Simultaneous-Talk-with-Summarizer). Blind final judgment is the strongest anti-groupthink mechanism — agents give honest assessments when they know others won't see their finals.

**AutoGen:** Not all agents need all messages (sparse topology). The solver/aggregator pattern cleanly separates evaluation (reviewers) from synthesis (judge). 40k+ stars validates the architecture.

**Du et al.:** Multi-agent debate improves factual accuracy over single-agent, but the mechanism is cross-verification (agents checking each other's claims), not discovery. This finding directly motivated the Completeness Auditor in v2.

**MachineSoM:** Without private reflection, agents abandon correct findings under social pressure. Conformity tracking (did an agent flip without new evidence?) catches groupthink.

**DebateLLM:** Binary agree/disagree is too coarse. Calibrated intensity (20-60%) per persona produces ~15% better debate quality. The summarizer between rounds keeps debate focused on unresolved points.

---

## v2.2 Adopts (Top 4)

These four techniques scored highest on impact-to-effort ratio. All are prompt-only changes — no architectural modifications needed.

### 1. Diverse Reasoning Strategies (DMAD, ICLR 2025)

**Paper:** "Diverse Multi-Agent Debate" — agents using different reasoning strategies (systematic enumeration, backward reasoning, adversarial simulation) outperform homogeneous-strategy panels by 12-18% on complex evaluation tasks.

**What we take:** Assign each persona a reasoning strategy that matches its evaluation lens. A Security Auditor thinks via adversarial simulation; an Architecture Critic reasons backward from the desired outcome.

**Implementation:** New `reasoning_strategy` field per persona, injected into Phase 2 prompts.

### 2. Anti-Rhetoric Guard ("Talk Isn't Always Cheap", 2025)

**Paper:** Demonstrates that eloquent-but-wrong arguments systematically override correct findings in multi-agent debate. Agents are persuaded by rhetorical quality rather than evidence quality.

**What we take:** Judge prompt includes an explicit anti-rhetoric assessment — flag arguments that swayed positions via rhetoric rather than evidence, weight line citations over eloquent argumentation.

**Implementation:** New section 0.5 in Phase 5 judge prompt, between "Verify Audit Findings" and "Evaluate Debate Quality."

### 3. Dynamic Sycophancy Intervention (CONSENSAGENT, ACL 2025)

**Paper:** Agents track conformity but most systems don't intervene when detected. CONSENSAGENT injects "sycophancy alerts" when >50% of position changes lack new evidence, requiring agents to identify a weakness in the consensus position.

**What we take:** After Phase 3.5 summarization, count position changes toward majority without new evidence. If >50%, inject a sycophancy alert into the next round's prompt.

**Implementation:** Sycophancy detection block added to Phase 3.5, after snippet rules.

### 4. Judge Confidence Gating (Trust or Escalate, ICLR 2025 Oral)

**Paper:** Judges should not always render definitive verdicts. When confidence is low (high panel disagreement, novel domain, ambiguous evidence), the verdict should flag "HUMAN REVIEW RECOMMENDED" rather than force a call.

**What we take:** Judge outputs a confidence level (High/Medium/Low). Low-confidence verdicts get a "HUMAN REVIEW RECOMMENDED" flag in the report.

**Implementation:** New field in Phase 5 section 6, propagated to Phase 6 report template.

---

## v2.8 Adopts (Panel-Reviewed, 2026-03-26)

Proposed 6 changes from 19-source deep research (`references/research-v28.md`). Ran a 4-reviewer panel (Feasibility Analyst, Stakeholder Advocate, Risk Assessor, Devil's Advocate) + Supreme Judge. Panel recommended 3 of 6 + 1 new mechanism. See `review_panel_report.md`.

### 1. Severity-Dampening Judge Prompt (Datadog FP Filtering)

**Source:** Datadog blog on LLM false positive filtering for static analysis.

**What we take:** Replace "what severity is this?" with "what is the minimum severity justified by concrete evidence?" in the judge prompt. Zero-cost prompt edit targeting the 2/3 P0 overstatement rate from v2.6 benchmark.

**Panel verdict:** Unanimous approval. Highest value-to-cost ratio of all proposals.

### 2. Coverage Check — NEW (Panel-Surfaced)

**Source:** Risk Assessor's finding that all 6 original proposals applied downward pressure on findings with zero upward pressure, creating systematic false-negative risk.

**What we take:** Judge sub-step asking "given these file changes, are there risk categories (security, error handling, race conditions, API contract violations) that no reviewer examined?" Cost: ~500 tokens.

**Why this matters:** Counterbalances the suppression stack. Without it, the panel would look cleaner but potentially miss more real issues. False positives are visible (user complains); false negatives are invisible (user never knows).

### 3. Verify-Before-Claim in Advisory Mode (Tool-MAD, CodeRabbit, Nexus)

**Sources:** Tool-MAD (Jan 2026), CodeRabbit AST-grep agent, Nexus execution-grounded verification (Oct 2025), CORE Proposer-Ranker (Microsoft FSE 2024).

**What we take:** Agents include `verification_command` for P0/P1 findings. Orchestrator runs grep/read before debate and annotates results. **Advisory, not gating** — failed verification demotes and annotates but does not delete. Max 5 verifications per run.

**Panel constraint:** The Risk Assessor correctly identified that grep failure does not equal disproof. Architectural/semantic findings cannot be grep-verified. Making verification gating would select for shallow, string-matchable issues and filter out high-value architectural critique.

### 4. Auto-Detected Precise/Exhaustive Mode (Qodo 2.0)

**Source:** Qodo 2.0 benchmark (60.1% F1 SOTA) with dual Precise/Exhaustive modes.

**What we take:** Auto-detect from input type. Code files → Precise mode (require concrete evidence, line numbers, code snippets). Plan/design docs → Exhaustive mode (allow broader risk identification). No user-facing toggle. One sentence in report header explains mode.

**Panel constraint:** Stakeholder Advocate emphasized auto-detection over user toggles (adoption ~0 for toggles).

### v2.8 Deferred (to v2.9)

| Proposal | Why Deferred | Reassess When |
|----------|-------------|---------------|
| **Three-tier finding classification** (Blincoe et al. IST 2022) | Double-suppression risk with severity-dampening judge. Two independent downward pressures with no upward pressure. | After measuring #1's impact on finding volume. If severity distribution is healthy, reconsider. |
| **Confidence scores 0-100** (ConfMAD EMNLP 2025, DAR March 2026) | All 4 reviewers opposed user-facing numeric scores. LLMs poorly calibrated on self-assessed confidence. Creates illusion of precision. | If internal confidence routing is needed for judge, implement as non-displayed metadata only. |
| **Meta-Review "defend or retract"** (adversarial-review repo) | High token cost (16-42k), creates commitment bias (high-confidence agents won't retract). Fold useful part into judge step instead. | If judge-only second-look proves insufficient at catching false positives. |

---

## Deferred (Pre-v2.8)

Techniques with clear value but requiring architectural changes, additional infrastructure, or more research before adoption.

### Trajectory Scoring (LLM-as-Judge trajectories, EMNLP 2025)

**Idea:** Score not just the final state of each reviewer's assessment, but the trajectory of their reasoning across rounds. Agents who converge toward correct findings via evidence accumulation are weighted higher than those who converge via conformity.

**Why deferred:** Requires a post-hoc scoring pass over the full debate transcript, adding a new phase and ~30% more tokens. The conformity tracking we already have (v2) captures the most important signal (flip-without-evidence) at much lower cost.

**Adopt when:** We have evidence that conformity tracking alone misses important trajectory patterns.

### Strategic Consensus (Game-Theoretic Debate, ASE 2025)

**Idea:** Model the debate as a cooperative game where agents maximize group accuracy, not individual persuasion. Agents receive utility signals based on whether the group's final answer improves.

**Why deferred:** Requires multiple evaluation rounds with ground-truth feedback — doesn't fit our use case (reviewing novel work with no ground truth). More applicable to benchmarks with known answers.

**Adopt when:** We add a self-evaluation mode where the panel reviews its own prior outputs.

### AST + LLM Hybrid (CodeReviewer++, ASE 2025)

**Idea:** Combine LLM-based review with AST (Abstract Syntax Tree) parsing for code reviews. The AST pass catches structural issues (unused variables, type mismatches, unreachable code) that LLMs miss, while the LLM catches semantic issues the AST misses.

**Why deferred:** Requires language-specific AST tooling (tree-sitter, etc.) integrated into the skill. Our skill reviews mixed content (plans, docs, code snippets) where AST parsing is impractical. The Completeness Auditor partially fills this role for code scrutiny.

**Adopt when:** We build a code-only review mode, or when Claude Code gains native AST access.

### SE-Jury (Multi-Judge Ensemble, ICLR 2025)

**Idea:** Instead of one supreme judge, use 3-5 judges with different evaluation criteria. The final verdict is the ensemble of judge opinions, reducing single-judge bias.

**Why deferred:** Our single Opus judge already receives comprehensive input (N reviewers + debate + audit). Adding 3-5 judge agents would 3-5x the judge-phase cost (~$2-4 per review). The anti-rhetoric guard (v2.2) addresses the main single-judge failure mode (being swayed by eloquence).

**Adopt when:** We find systematic single-judge blind spots that the anti-rhetoric guard doesn't catch.

### Model Diversity (from Trust Evaluation, Priority: High)

**Problem:** All reviewers share the same base model (Opus), so "independent" reviews have correlated biases. 5 Opus reviewers catching the same bug is less valuable than 4 Opus + 1 different-architecture model catching different bugs.

**Proposed solution:** Assign 1-2 reviewer slots to a fundamentally different model architecture (e.g., Codex, Gemini, or open-source via API). A smaller Claude model (Sonnet) still shares the same training pipeline — true diversity requires a different architecture.

**Why deferred:** Claude Code's Agent tool only spawns Claude subagents. Requires external API integration outside the skill framework. **Adopt when:** Claude Code gains multi-model agent support, or we build an external orchestration wrapper.

### Synthetic Benchmark Suite (from Trust Evaluation, Priority: High)

**Problem:** Panel scores (e.g., "7/10") are uncalibrated — no ground truth to know if higher scores correlate with fewer actual bugs.

**Proposed solution:** Build a test corpus of 20-50 code samples with known bugs across difficulty tiers (easy/medium/hard/clean). Measure detection rate, false positive rate, score calibration, and model diversity impact. Add calibration footnote to every report.

**Why deferred:** 2-3 days for initial corpus + automation. Re-calibrate quarterly. **Adopt when:** Resources available for benchmark creation. Would transform panel from "trust because authoritative" to "trust because measured."

### Explicitly Deferred (Low ROI)

| Item | Why Deferred |
|------|-------------|
| Provenance graph | Users care about the verdict, not the deliberation process. Transcript is already available. |
| Run-over-run stability | Expensive (run panel twice) and stability ≠ accuracy. Better to invest in benchmarks. |
| Confidence decay | Reviews are point-in-time; they don't "age" meaningfully. |
| User correction feedback loop | Panel runs ad-hoc, not continuously. No natural feedback path. |

---

## Not Applicable

Techniques evaluated and rejected for our use case.

### Cross-Model Adversarial (GPT vs Claude debate)

**Idea:** Use different model families (GPT-4, Claude, Gemini) as different reviewers to get genuinely different reasoning patterns.

**Why not applicable:** Claude Code's Agent tool only spawns Claude subagents. Cross-model debate requires external API orchestration outside the skill framework. Additionally, model-specific prompt tuning would be required for each family.

### Meta-Judge (Judge-of-Judges)

**Idea:** A meta-judge evaluates the quality of the supreme judge's reasoning before presenting to the user.

**Why not applicable:** Adds another Opus call (~2 minutes, ~15k tokens) for marginal quality improvement. The judge already receives structured input from N reviewers + audit. The confidence gating mechanism (v2.2) addresses the main concern (overconfident verdicts) more efficiently.

### Many-Small-Agents (Swarm Review)

**Idea:** Use 20-50 small (Haiku-class) agents instead of 4-6 large (Opus-class) agents. Aggregate via voting.

**Why not applicable:** Our skill requires deep reasoning per persona — nuanced code review, security analysis, architectural evaluation. Haiku-class agents lack the reasoning depth for these tasks. The quantity-over-quality trade-off works for simple classification but not expert review.

---

## Research Sources

### Academic Papers (17+)

| Paper | Venue | Year | Status |
|-------|-------|------|--------|
| ChatEval | ICLR | 2024 | **Incorporated** (v1) |
| Du et al. — Multi-Agent Debate for Factuality | ICML | 2024 | **Incorporated** (v1) |
| MachineSoM — Society of Mind | ACL | 2024 | **Incorporated** (v2) |
| DMAD — Diverse Multi-Agent Debate | ICLR | 2025 | **v2.2** |
| "Talk Isn't Always Cheap" — Rhetoric in Debate | ICML | 2025 | **v2.2** |
| CONSENSAGENT — Sycophancy Intervention | ACL | 2025 | **v2.2** |
| Trust or Escalate — Judge Confidence | ICLR (Oral) | 2025 | **v2.2** |
| CORE — Dual Proposer-Ranker | FSE (Microsoft) | 2024 | **v2.8** (verify-before-claim) |
| SGCR — Specification-Grounded Code Review | ASE | 2025 | **v2.8** (compliance check) |
| Tool-MAD — Tool-Augmented Debate | arXiv | 2026 | **v2.8** (tool use) |
| Nexus — Execution-Grounded Verification | arXiv | 2025 | **v2.8** (advisory verification) |
| ConfMAD — Confidence-Calibrated Debate | EMNLP | 2025 | v2.9 (deferred) |
| DAR — Diversity-Aware Retention | arXiv | 2026 | v2.9 (deferred) |
| Blincoe et al. — Code Review Concern Taxonomy | IST | 2022 | v2.9 (deferred) |
| LLM-as-Judge Trajectories | EMNLP | 2025 | Deferred |
| Game-Theoretic Debate | ASE | 2025 | Deferred |
| CodeReviewer++ (AST + LLM) | ASE | 2025 | Deferred |
| SE-Jury (Multi-Judge Ensemble) | ICLR | 2025 | Deferred |

### GitHub Projects (14)

| Project | Stars | Relevance |
|---------|-------|-----------|
| thunlp/ChatEval | ~200 | Core architecture — personas, blind judgment |
| microsoft/autogen | 40k+ | Solver/aggregator, sparse topology |
| zjunlp/MachineSoM | ~100 | Private reflection, conformity tracking |
| instadeepai/DebateLLM | ~50 | Agreement intensity, summarizer |
| Du et al. reference impl | — | Cross-verification prompting |
| DMAD reference impl | — | Diverse reasoning strategy assignment |
| CONSENSAGENT reference impl | — | Sycophancy detection + intervention |
| Trust-or-Escalate reference impl | — | Confidence-gated verdicts |
| CodeReviewer++ | — | AST + LLM hybrid (deferred) |
| SE-Jury reference impl | — | Multi-judge ensemble (deferred) |
| Game-Theoretic-Debate impl | — | Strategic consensus (deferred) |
| LLM-Judge-Trajectories | — | Trajectory scoring (deferred) |
| Multi-Agent-Review-Bench | — | Benchmark suite for review panels |
| AgentReview | — | Survey of agent-based review systems |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 127+ agents | Specialist agent catalog for persona-to-agent mapping (v2.9) |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-03-14 | ChatEval + AutoGen + Du et al. foundations |
| v2 | 2026-03-15 | MachineSoM + DebateLLM additions |
| v2.1 | 2026-03-17 | Auto-persona, inline snippets, prompt injection boundaries |
| v2.2 | 2026-03-18 | DMAD reasoning strategies, anti-rhetoric guard, sycophancy intervention, confidence gating |
| v2.3 | 2026-03-18 | Knowledge mining, domain checklists, deep research mode |
| v2.4 | 2026-03-19 | Skill/Docs Portability signal group |
| v2.5 | 2026-03-20 | Trust & verification layer (claim verification, epistemic labels) |
| v2.6 | 2026-03-25 | Schliff optimisation (75→86), reference extraction, A/B validated |
| v2.7 | 2026-03-26 | Severity verification, temporal scope, defect classification |
| v2.8 | 2026-03-26 | Panel-reviewed: severity dampening, coverage check, verify-before-claim, auto mode |
| v2.9 | 2026-03-29 | VoltAgent specialist agent integration (127+ agents, 10 families) |
| v2.10 | 2026-03-30 | Codebase state check — prevents false "missing code" findings in worktrees |
| v2.11 | 2026-04-03 | Verification round — Phase 4.8 tier assignment + Phase 4.9 targeted verification agents (persona-matched to claim type, tiered Light/Standard/Deep budgets) |
| v2.12 | 2026-04-03 | Triple output format — primary markdown report + process history + interactive HTML dashboard |
| v2.13 | 2026-04-03 | Persona profiles surfaced in process history (Registry section, inline blocks) and HTML dashboard (Panel Gallery with avatar cards, filter-by-reviewer) |
| v2.14 | 2026-04-07 | **Phase 2 Data Flow Trace** (composition bug detector with Standard/Thorough/Exhaustive tiers), **Multi-Run Union Protocol** + Phase 16 Merge, **Force `model: "opus"`** on all subagent launches, integer phase renumbering (1–16 with sub-phases 12a/12b + 15.1/15.2/15.3) |
| v2.15 | 2026-04-07 | **Expandable 10-section issue cards** in Phase 15.3 HTML dashboard (narrative, code evidence, debate, judge ruling, fix recommendation, cross-references, prior runs), deep-linking, keyboard nav, expand all/collapse all, print-friendly CSS, Prism.js syntax highlighting (CDN) |
| v2.16 | 2026-04-07 | **Canonical plugin layout** — restructured to `plugins/<name>/SKILL.md` + `plugins/<name>/.claude-plugin/plugin.json` for Claude Code plugin marketplace compliance (PR #18). Marketplace manifest moved to `.claude-plugin/marketplace.json` with owner-prefixed name. Follow-ups: install-command fix + stale-clone diagnosis docs (PR #19), README dedupe + plugin rebrand + version drift cleanup (PR #20), 4 cross-version consistency assertions (PR #21). |
| v2.16.1 | 2026-04-08 | **Multi-plugin marketplace bundle** (PR #22) — renamed marketplace to `plugin`; bundled `plan-review-integrator` v2.0.0 as a second plugin in the same repo; moved `eval-suite.json` to per-plugin location; refactored `manifest-consistency` and `trigger-classification` tests to iterate all plugins with independent per-plugin cross-version checks. Test count: 308 → 352. |
| v2.16.2 | 2026-04-08 | **README unification** (PR #25) — unified shell-form and REPL-form install instructions with shell-form as primary. |
| v2.16.3 | 2026-04-09 | **External domain claim web verification in Phase 11** — P0/P1 findings with external domain claims (product limits, API behavior, regulatory jurisdiction) auto-verified via web search. New labels: `[WEB-VERIFIED]`, `[WEB-CONTRADICTED]`, `[WEB-INCONCLUSIVE]`. |
| v2.16.4 | 2026-04-15 | **Phase 15.3 reliability fix** (PR #26) — sequential Phase 15 execution (15.1→15.2→15.3), disk-reading data strategy (agent reads files instead of orchestrator injection), mandatory verification gate, manual recovery path. Fixes silent HTML report generation failure. |
| v2.16.5 | 2026-04-19 | **Plugin skills subdir layout** (PR #30) — restructured to `plugins/<name>/skills/<name>/SKILL.md` for Claude Code ≥2.1.112 auto-discovery; dropped the `skills` field from plugin.json. First external contribution from [@okuuva](https://github.com/okuuva). |
| v3.0.0 | 2026-04-27 | **Single-plugin layout** (PR #33) — collapsed multi-plugin marketplace to one plugin (`roundtable`) bundling two skills (`agent-review-panel` + `plan-review-integrator`), mirroring [obra/superpowers](https://github.com/obra/superpowers). Plugin name `roundtable` kept (works as a collective noun for the bundle; `/roundtable:agent-review-panel` reads more meaningfully than doubled-name alternatives — see PR #32 discussion). Adds `scripts/release-check.sh` pre-release doc-drift detector. **BREAKING:** the second-plugin install command `plan-review-integrator@agent-review-panel` is removed (the skill is now bundled into `roundtable`). |
| v3.1.0 | 2026-04-27 | **Silent-phase-compression fix** (PR #39, [#35](https://github.com/wan-huiyan/agent-review-panel/issues/35)) — file-based subagent state for Phases 3 / 4 / 5 / 7 / 8 / 10 / 11 / 14 (subagents return `{path, summary}` instead of verbatim content), new Phase 13.5 Pre-Judge Verification Gate, Phase 14 reads state on demand, fail-loud `⚠️ COMPRESSED RUN` header + `[COMPRESSED]` action-item suffix when the gate detects unrecoverable phase loss. Eliminates the v3.0.0 orchestrator-context bloat (~75k tokens × 6 phases) that drove silent compression of mandatory phases. |

---

*This roadmap is maintained alongside the marquee skill at `skills/agent-review-panel/SKILL.md`. For the bundled `plan-review-integrator` skill, see `skills/plan-review-integrator/SKILL.md`. (v3.0+ single-plugin layout — pre-v3.0 these lived under `plugins/<name>/`.)*
