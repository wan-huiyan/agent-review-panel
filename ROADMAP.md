# Agent Review Panel — Research Roadmap

A living document mapping academic research and open-source projects to skill features. Organized by adoption status.

---

## Already Incorporated (v1–v2.6)

These foundations form the core architecture. Research adopted in v1–v2.5; structural optimisation in v2.6.

| Source | What We Took | Version |
|--------|-------------|---------|
| **ChatEval** (thunlp/ChatEval, ICLR 2024) | Blind final judgment, persona system, anti-groupthink | v1 |
| **AutoGen** (microsoft/autogen) | Solver/aggregator architecture, sparse topology, round management | v1 |
| **Du et al.** (ICML 2024) | Cross-verification for factuality, debate-improves-accuracy thesis | v1 |
| **MachineSoM** (zjunlp/MachineSoM, ACL 2024) | Private reflection rounds, conformity tracking (tf/ft/tt/ff) | v2 |
| **DebateLLM** (instadeepai/DebateLLM) | Agreement intensity modulation, round summarization, judge-mediated convergence | v2 |

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

## Deferred

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

### Academic Papers (11)

| Paper | Venue | Year | Status |
|-------|-------|------|--------|
| ChatEval | ICLR | 2024 | **Incorporated** (v1) |
| Du et al. — Multi-Agent Debate for Factuality | ICML | 2024 | **Incorporated** (v1) |
| MachineSoM — Society of Mind | ACL | 2024 | **Incorporated** (v2) |
| DMAD — Diverse Multi-Agent Debate | ICLR | 2025 | **v2.2** |
| "Talk Isn't Always Cheap" — Rhetoric in Debate | ICML | 2025 | **v2.2** |
| CONSENSAGENT — Sycophancy Intervention | ACL | 2025 | **v2.2** |
| Trust or Escalate — Judge Confidence | ICLR (Oral) | 2025 | **v2.2** |
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

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1 | 2026-03-14 | ChatEval + AutoGen + Du et al. foundations |
| v2 | 2026-03-15 | MachineSoM + DebateLLM additions |
| v2.1 | 2026-03-17 | Auto-persona, inline snippets, prompt injection boundaries |
| v2.2 | 2026-03-18 | DMAD reasoning strategies, anti-rhetoric guard, sycophancy intervention, confidence gating |

---

*This roadmap is maintained alongside the skill at `~/.claude/skills/agent-review-panel/`.*
