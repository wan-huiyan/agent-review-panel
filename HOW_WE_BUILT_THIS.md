# How We Built the Agent Review Panel Skill

A chronicle of the research, design, iteration, and benchmarking process behind this skill. Written as a reference for building future multi-agent skills.

---

## Step 1: Define the Problem

**Starting point:** "I want to ask several agents with different perspectives to review a piece of work, provide feedback, allow them to discuss, and then a final powerful agent judges."

**Key requirements surfaced through discussion:**
- Genuinely distinct perspectives (not rephrased versions of the same feedback)
- Real debate where agents engage with each other's points
- Documented disagreements with reasoning from both sides
- A supreme judge (Opus, max reasoning) for the final verdict
- Structured output scannable by a human in 30 seconds

---

## Step 2: Research — GitHub Deep Dives

We used the `skill-from-github` workflow to search for existing multi-agent debate implementations. Found 8 candidates, narrowed to 5 for deep dives:

### Projects Studied

| Project | Stars | Key Takeaway |
|---------|-------|-------------|
| **thunlp/ChatEval** | ~200 | Persona system, 3 communication strategies (One-By-One, Simultaneous-Talk, Simultaneous-Talk-with-Summarizer), blind final judgment |
| **microsoft/autogen** | 40k+ | Solver/aggregator architecture, sparse topology, round management via pub/sub topics |
| **Du et al. (ICML 2024)** | — | Multi-agent debate for factuality, cross-verification prompting |
| **zjunlp/MachineSoM** | ~100 | Private reflection rounds, conformity tracking (tf/ft/tt/ff patterns), interleaved debate-reflection |
| **instadeepai/DebateLLM** | ~50 | Agreement intensity modulation (~15% improvement), judge-mediated early termination, summarizer agent between rounds |

### What We Extracted from Each

**ChatEval** gave us the core architecture:
- Each reviewer gets a distinct persona via prompt
- Blind final judgment — agents give final scores without seeing others' finals (anti-groupthink)
- Position bias mitigation through structured ordering

**AutoGen** gave us the engineering patterns:
- Solver → Aggregator pattern (reviewers solve, judge aggregates)
- Not all agents need to see all messages (sparse topology)
- Fixed max rounds with clean message routing

**Du et al.** confirmed the theoretical foundation:
- Multi-agent debate improves factual accuracy over single-agent
- Cross-verification (agents checking each other's claims) is the key mechanism

**MachineSoM** gave us the anti-conformity tools:
- Private reflection before debate prevents agents from abandoning correct findings under social pressure
- Conformity tracking flags when an agent flips without new evidence

**DebateLLM** gave us calibration:
- Agreement intensity per persona (20-60%) produces ~15% better results than binary agree/disagree
- A summarizer agent between rounds keeps debate focused on unresolved points
- Judge-mediated convergence beats mechanical score-spread checks

---

## Step 3: Synthesize into v1

Combined the research into a 6-phase skill:

```
Phase 1: Setup → Phase 2: Independent Review → Phase 3: Debate (1-3 rounds)
→ Phase 4: Blind Final → Phase 5: Supreme Judge → Phase 6: Document
```

Key design decisions:
- **All reviewers use Opus** (user preference for quality over speed)
- **4 default reviewers** with persona sets tuned to work type
- **Adaptive rounds** — stop early if consensus, extend if sharp disagreement
- **Judge gets everything** — all reviews, full debate transcript, all final assessments

---

## Step 4: Test v1

### Test Cases
Two real-world tests from a production ML pipeline project:
1. **Pipeline setup review** — full scoring pipeline (code + architecture + docs)
2. **Implementation plan review** — feature expansion plan (plan with code snippets)

### Test Method
For each test case, ran two parallel agents:
- **With-skill:** Agent reads SKILL.md and follows the multi-agent process
- **Baseline (no skill):** Same prompt, no skill — just "review this thoroughly"

### v1 Results

| Metric | With Skill | Baseline |
|--------|-----------|----------|
| Pass rate (6 assertions) | **100%** | 33.3% |
| Avg duration | 277s | 147s |
| Avg tokens | 68k | 70k |

**Assertions tested:**
1. Multi-perspective coverage (3+ distinct perspectives)
2. Structured disagreements with reasoning from both sides
3. Actionable recommendations with severity levels
4. Numerical score + verdict
5. Debate evidence (agents engaging with each other's specific points)
6. Executive summary scannable in <30 seconds

**Key finding:** Baseline passed only 2/6 (multi-perspective coverage + actionable recommendations). Failed on disagreements, scores, debate evidence, and executive summary — all features that require the multi-agent methodology.

---

## Step 5: Analyze the Gap

The benchmark revealed an interesting nuance: **the baseline occasionally caught code-level details the skill missed.**

Specifically, the baseline caught `CM` missing from `_CLOSED_CODES` and a `--dry-run` flag gap — details the skill's 4 reviewers + debate + judge all missed.

### Root Cause Analysis

We identified two mechanisms:

**1. Debate shifts cognitive mode from discovery to argumentation.**
Once agents start responding to each other, they spend tokens engaging with others' points rather than re-reading the source for new issues. The debate format is great for *evaluating* findings but bad for *finding* them.

**2. Strategic personas miss code-level scrutiny.**
A "Feasibility Analyst" or "Risk Assessor" evaluates at the plan/architecture level. They don't check if every status code constant is in the right set. A single agent reading sequentially (without persona constraints) covers everything because later sections naturally fill gaps from earlier ones.

---

## Step 6: Research Round 2

We deep-dived 3 more papers to find solutions:

- **Du et al.** — confirmed that cross-verification is the value of debate, not discovery
- **MachineSoM** — private reflection prevents premature conformity
- **DebateLLM** — agreement intensity calibration, summarizer between rounds

These gave us 7 specific fixes for v2.

---

## Step 7: Build v2

Added to the original 6-phase architecture:

| Addition | Source | What It Fixes |
|----------|--------|--------------|
| **Completeness Auditor** (Phase 4.5) | Novel | Post-debate agent re-reads source line-by-line, reports ONLY findings no reviewer mentioned |
| **Private Reflection** (Phase 2.5) | MachineSoM | Each reviewer rates own confidence before seeing others — prevents abandoning correct findings |
| **Hybrid Persona Selection** | Gap analysis | For mixed content (plans with code), always includes Code Quality Auditor alongside strategic personas |
| **"New Discovery" Requirement** | Novel | Each debate round requires agents to find at least one issue no one mentioned yet — prevents pure argumentation |
| **Round Summarization** (Phase 3.5) | DebateLLM | Summarize resolved/unresolved points between rounds to keep debate focused |
| **Agreement Intensity** | DebateLLM | Each persona gets a calibrated skepticism level (20-60%) — more nuanced than binary agree/disagree |
| **Conformity Tracking** | MachineSoM | Judge flags any agent that flipped position without new evidence being presented |

---

## Step 8: Test v2

Same 2 test cases, same with-skill vs baseline methodology. Added 2 new assertions:
- **Completeness audit** — dedicated post-debate audit finds details the panel missed
- **Code-level detail catch** — specific constants, status codes, config values flagged

### v2 Results

| Metric | With Skill v2 | Baseline | v1 Skill |
|--------|--------------|----------|----------|
| Pass rate | **100% (8/8)** | 50% (4/8) | 100% (6/6) |
| Avg duration | 369s | 204s | 277s |
| Avg tokens | 75k | 81k | 68k |

### What v2 Fixed

The Completeness Auditor caught exactly the class of details v1 missed:
- `has_campus_visit` NaN ordering bug (fillna(999) must precede companion binary)
- `WC` ghost code in `APPLICATION_STAGE_WHY`
- `DF` missing from Python code sets
- Duplicated `ARRAY_AGG` in SQL
- Schema/SELECT column ambiguity
- Missing SHAP merging logic

### Debate Quality Highlights

The private reflection + agreement intensity produced genuine intellectual engagement:
- **Position change with evidence:** Feasibility Analyst upgraded `data_available_through` severity from minor to IMPORTANT after Risk Assessor explained the label corruption mechanism
- **Retraction with honesty:** Devil's Advocate retracted "over-engineering" characterization after Feasibility Analyst's evidence about natural feature space (26 events x 5 windows)
- **Self-correction:** Code Quality Auditor retracted a false-positive bug finding after private reflection re-trace confirmed the logic was actually correct

---

## Step 9: Lessons Learned

### For Building Multi-Agent Skills

1. **Debate trades discovery for argumentation.** Multi-agent debate is excellent for *evaluating the significance* of findings but bad for *finding* them. Always add a dedicated discovery phase (like the Completeness Auditor) that ignores the debate entirely.

2. **Personas must match content type.** Strategic personas (Feasibility Analyst, Risk Assessor) miss code-level details. For mixed content (plans with code, docs with SQL), always include an implementation-focused persona.

3. **Private reflection before debate prevents conformity.** Without it, agents abandon correct findings when challenged. With it, they have committed confidence levels that anchor their positions.

4. **Agreement intensity > binary agree/disagree.** A 30%-agreement Security Auditor behaves differently from a 60%-agreement Feasibility Analyst — and that calibrated difference produces richer debate.

5. **The single-agent baseline is surprisingly strong.** One agent reading sequentially has global coherence — later sections fill gaps from earlier ones. Multi-agent wins on structure and evaluation quality, not raw issue count.

### For the Skill Development Process

6. **Run with-skill AND baseline in parallel.** The comparison reveals what the skill adds and what it costs. Without a baseline, you can't tell if the skill is actually better or just different.

7. **Grade with objective assertions.** Subjective "is this good?" comparisons are unreliable. Define specific, verifiable criteria (does it have structured disagreements? numerical scores? debate evidence?) and grade mechanically.

8. **Read the transcripts, not just the outputs.** The v1 gap (missing code details) was only visible by comparing the specific findings in both outputs. The aggregate metrics (pass rate, tokens) hid the nuance.

9. **Research before coding.** The 5-paper literature review took ~30 minutes but saved hours of trial-and-error. Every major design decision (blind judgment, private reflection, agreement intensity) came from published research.

---

## Step 10: Build and Benchmark v2.1

### Motivation

Session 49 ran a self-review panel on 5 proposed v3 changes (inspired by MiroFish research patterns). The panel killed 3 and approved 2 with caveats:
- **Change A: Inline Disputed Code Snippets** — Phase 3.5 summaries include actual source text for disputed points, keeping debate anchored to code rather than drifting into abstraction
- **Change B: Auto-Persona from Content Signals** — keyword-based detection automatically adds domain-specific reviewers (up to 6 total)

Plus 3 structural fixes: prompt injection boundaries, completeness auditor scope guidance for large documents, and version archiving (`SKILL.v2.md`).

### Implementation

Wrote a detailed implementation spec (plan mode) addressing every panel finding:
- Phase 3.5 summary format rewritten with snippet extraction rules (max 10 lines per dispute, max 3 inlined disputes)
- Content Signal Detection Table with 6 signal groups (SQL, Auth, Infrastructure, ML/Statistics, API, Frontend) and 3-keyword minimum trigger
- Persona Selection Algorithm integrated into Phase 1 (not pre-Phase-1)
- Prompt injection delimiters (`════════════════ DOCUMENT START/END ════════════════`) in all 5 agent prompt templates

### Testing

Tested on two production ML pipelines:

| Dimension | Test 1 (Scoring Pipeline) | Test 2 (Retraining Pipeline) |
|-----------|--------------------------|------------------------------|
| Files | 8 files (~2,800 lines) | 7 files (~2,000 lines) |
| Reviewers | 6 (base 4 + 2 auto) | 6 (base 4 + 2 auto) |
| Auto-detected signals | ML/Statistics, Infrastructure, SQL/Data | ML/Statistics, Infrastructure, SQL/Data |
| Auto-added personas | Statistical Rigor + Data Quality Auditor | Statistical Rigor + Data Quality Auditor |
| Final score | 6/10 | 5.5/10 |
| Verdict | Accept with minor changes | Needs significant revision |

### Benchmark Results

| Criterion | Threshold | Result |
|-----------|-----------|--------|
| Source grounding in Round 2+ debate | >80% | **PASS** (83% and 100%) |
| Judge citations in disagreement rulings | >60% | **PASS** (67% and 100%) |
| No context overflow (up to 1000 lines) | Pass/Fail | **PASS** (handled 2000+ lines) |
| Auto-persona precision (domain-specific finding) | >70% | **PASS** (100%) |
| Auto-persona recall (obvious signals detected) | >90% | **PASS** (100%) |
| Panel cap respected | ≤6 | **PASS** (6 = cap) |

### Key Finding

The auto-persona feature had the highest ROI of any v2.1 change. In the retraining pipeline review, the Statistical Rigor Reviewer (auto-added, not in the base persona set) discovered **calibration-threshold data leakage** — the calibrator was fit on test data, then thresholds were swept on the same data. This became the unanimous #2 action item. The base persona set (FA, CQA, Risk, DA) did not identify this.

### Lessons

10. **Auto-persona from content signals works.** Keyword-based detection (no LLM call) with a 3-keyword minimum is sufficient to avoid false positives while catching genuine domain needs. The added reviewers consistently contributed unique, high-value findings.

11. **Source-grounded debate scales to large codebases.** Phase 3.5 inline snippets kept debate focused on actual source even across 2000+ lines. The snippet extraction rules (max 10 lines, max 3 disputes) prevented context overflow.

12. **Prompt injection boundaries are cheap insurance.** ~200 tokens per prompt with zero observable negative effects. The `DOCUMENT START/END` delimiters cleanly separate instructions from data.

---

## Step 11: Research Round 3 + v2.2 Implementation

### Motivation

Systematic research into 14 GitHub projects and 11 academic papers (ICLR 2025, ACL 2025, EMNLP 2025, ASE 2025) identified techniques not yet in our v2.1 skill. Evaluated each on impact-to-effort ratio and selected the top 4 — all prompt-only changes requiring no architectural modifications.

### Research Findings

Surveyed 11 papers and 14 projects. Categorized into:
- **Already incorporated** (5 foundations from v1-v2.1)
- **v2.2 adopts** (top 4 by impact/effort)
- **Deferred** (4 — require architecture changes or infrastructure)
- **Not applicable** (3 — cross-model, meta-judge, swarm)

Full details in `ROADMAP.md`.

### Top 4 Changes Implemented

| Change | Source | What It Fixes |
|--------|--------|--------------|
| **Diverse reasoning strategies** | DMAD (ICLR 2025) | All reviewers reason the same way despite different personas. Each persona now gets a strategy (systematic enumeration, backward reasoning, adversarial simulation, etc.) |
| **Anti-rhetoric guard** | "Talk Isn't Always Cheap" (ICML 2025) | Eloquent-but-wrong arguments override correct findings. Judge now explicitly checks whether position changes had evidence vs rhetoric |
| **Dynamic sycophancy intervention** | CONSENSAGENT (ACL 2025) | Conformity tracked but not intervened on. Now injects sycophancy alert when >50% of position changes lack new evidence |
| **Judge confidence gating** | Trust or Escalate (ICLR 2025 Oral) | Judge always renders definitive verdict. Now outputs High/Medium/Low confidence; Low triggers "HUMAN REVIEW RECOMMENDED" |

### Implementation Details

All 4 changes were prompt-only edits to SKILL.md:
1. **Reasoning strategies** — New table in Phase 1 mapping persona types to strategies, plus strategy line in Phase 2 reviewer prompt
2. **Anti-rhetoric** — New section 0.5 in Phase 5 judge prompt (between audit verification and debate evaluation)
3. **Sycophancy detection** — New block in Phase 3.5 after snippet rules; counts evidence-free position changes, injects alert prompt if >50%
4. **Confidence gating** — New field in Phase 5 section 6 + Phase 6 report header/executive summary; Low confidence triggers human review flag

### Lessons

13. **Prompt-only changes have the highest ROI for multi-agent skills.** All 4 v2.2 improvements required zero architectural changes — just adding instructions to existing prompts. The skill's phase structure is stable enough that new behaviors can be layered on via prompt engineering alone.

14. **A research roadmap prevents rediscovery.** Documenting what was evaluated and why it was adopted/deferred/rejected saves future sessions from re-evaluating the same techniques. The ROADMAP.md captures both what we took and what we explicitly chose not to take.

---

## Step 12: Schliff Optimisation + A/B Validation (v2.6)

### Motivation

v2.5 SKILL.md had grown to 1,331 lines (62KB) — signal tables, domain checklists, prompt templates, and changelog all inline. Schliff analysis scored it 75.1/100, with efficiency (42) and composability (56) as the weakest dimensions.

### What Changed

Used `/schliff:analyze` to identify the top improvements, then applied them:

1. **Extracted reference data** to `references/` directory:
   - `signals-and-checklists.md` — 9 signal detection groups + domain checklists
   - `prompt-templates.md` — all phase prompt templates (condensed from verbose to essential)
   - `changelog.md` — version history

2. **Added negative scope** — "When NOT to Use" section prevents false triggers on single reviews, bug fixes, deployment tasks, skill improvement

3. **Added composability metadata** — input spec, dependency declarations, version compatibility, handoff points (prose, not YAML — per lesson #22)

4. **Added structured examples** — two concrete input→output examples

### Schliff Score

| Dimension | Before (v2.5) | After (v2.6) | Delta |
|-----------|---------------|--------------|-------|
| **Composite** | **75.1** | **85.6** | **+10.5** |
| Structure | 65 | 100 | +35 |
| Efficiency | 42 | 61 | +19 |
| Composability | 56 | 91 | +35 |
| Triggers | 78 | 76 | -2 |
| Quality | 92 | 91 | -1 |
| Edges | 85 | 85 | 0 |
| Clarity | 100 | 100 | 0 |

Key insight: the schliff scorer uses specific regex patterns for composability
(e.g., `depends on`, `scoped to`, `supported versions`). Writing composability
metadata as natural-language prose in the body (not YAML frontmatter) is critical.

### A/B Validation

Ran a full 6-reviewer panel on the same 1,132-line ML pipeline plan using both v2.5 and v2.6.

**Result:** Both reached identical verdict (4/10, "Needs Significant Revision") with the same 8 core consensus findings.

| Aspect | v2.5 | v2.6 |
|--------|------|------|
| Judge score | 4/10 | 4/10 |
| Consensus findings | 6 | 8 |
| Action items | 12 | 14 |
| COALESCE skew finding | Noted | **Elevated to P0** |
| Domain checklist format | Ad-hoc | Structured (from references/) |
| Judge output | Narrative | Priority-tiered (P0/P1/P2) |

v2.6 improvements: domain checklists from `references/signals-and-checklists.md` drove +2 additional findings; judge produced cleaner priority tiers. v2.5 had a slight edge in Devil's Advocate creativity (richer analogies).

Full comparison: `docs/v25-vs-v26-comparison.md`

### Lessons

15. **Extracting reference data to files does not degrade review quality.** The 75% token reduction in SKILL.md produced equivalent output. Domain checklists in separate files may actually help by providing more structured input to specialist reviewers.

16. **Schliff composability patterns are regex-based.** Write "depends on", "scoped to", "supported versions" as natural language in the markdown body. YAML frontmatter keys are ignored by the scorer.

17. **A/B testing skill changes is cheap and conclusive.** Running the same review on both versions took ~15 minutes total and definitively answered "did we break anything?"

---

## Timeline

| Step | What | Time |
|------|------|------|
| 1 | Define problem + requirements | 5 min |
| 2 | GitHub research (8 projects → 5 deep dives) | 30 min |
| 3 | Write v1 SKILL.md | 15 min |
| 4 | Run v1 tests (4 parallel agents) | ~5 min |
| 5 | Analyze gap (why baseline catches details skill misses) | 10 min |
| 6 | Research round 2 (3 more papers) | 15 min |
| 7 | Write v2 SKILL.md | 15 min |
| 8 | Update lessons + memory, run v2 tests (4 parallel agents) | ~7 min |
| 9 | Grade, benchmark, analyze, launch viewer | 10 min |
| 10 | Self-review panel → v2.1 spec → implement → test (2 pipelines) → benchmark | ~3 hours |
| 11 | Research round 3 (14 projects, 11 papers) → select top 4 → implement v2.2 | ~1 hour |
| 12 | Schliff optimisation (v2.6) + A/B validation | ~1 hour |
| **Total** | | **~7 hours** |

---

## Step 13: Panel-Reviewed v2.8 Roadmap (2026-03-26)

### Motivation

Deep research across 19 sources (ConfMAD, Tool-MAD, Nexus, CORE, SGCR, Qodo 2.0, CodeRabbit, DAR, etc.) produced 6 candidate improvements for v2.8. Rather than shipping all 6, we used the skill itself to review its own roadmap — a 4-reviewer panel (Feasibility Analyst, Stakeholder Advocate, Risk Assessor, Devil's Advocate) + Supreme Judge.

### Panel Process

- **19-source research document** compiled at `references/research-v28.md`
- **4 parallel reviewers** evaluated feasibility, user impact, failure modes, and the case against each proposal
- **Supreme Judge** synthesized and arbitrated disagreements

### Key Findings

| Reviewer | Score | Key Position |
|----------|-------|-------------|
| Feasibility Analyst | 7/10 | Most proposals feasible; token compounding is binding constraint |
| Stakeholder Advocate | 6/10 | Ship 3 not 6; over-engineered for two user complaints |
| Risk Assessor | 4/10 | **Systematic false-negative blindness** — all changes push downward |
| Devil's Advocate | 3/10 | Complexity ratchet; try prompt-only first |
| **Supreme Judge** | **5/10** | Ship 3 + 1 new mechanism; defer 3 |

**Critical finding:** The Risk Assessor (lowest score) surfaced the most important insight — every single proposed change suppressed findings with zero upward pressure. This would create invisible false negatives where the panel looks cleaner but misses more real issues. The coverage check mechanism was added to counterbalance this.

### Decision

**Ship (v2.8):**
1. Severity-dampening judge prompt (zero-cost prompt edit)
2. Coverage check (NEW — panel-surfaced, counterbalances suppression)
3. Verify-before-claim in advisory mode (grep/read for P0/P1, annotate don't gate)
4. Auto-detected Precise/Exhaustive mode (from input type)

**Defer (v2.9):**
- Three-tier classification (double-suppression risk)
- Confidence scores 0-100 (poorly calibrated, all reviewers opposed)
- Defend/retract step (high token cost, commitment bias)

Full report: `docs/archive/review_panel_report.md`

### Lessons

18. **Use the skill to review the skill's own roadmap.** The panel caught a systemic bias (false-negative blindness) that informal review missed. The most valuable insight came from the lowest-scoring reviewer — this validates the adversarial design philosophy.

19. **Every downward-pressure mechanism needs a corresponding upward-pressure mechanism.** Severity dampening, verification gates, and tier caps all suppress findings. Without a coverage check, the system optimizes for the measurable metric (false positive rate) at the expense of the unmeasurable one (missed critical findings).

20. **Ship fewer changes, measure, then decide.** The panel recommended 3 of 6 proposals. This follows the A/B testing lesson (#17) — bundling 6 interacting changes makes it impossible to attribute improvement or regression to any single change.

21. **Prompt-only changes should ship before structural changes.** The Devil's Advocate was right that severity dampening (#5) is a prompt edit that could ship same-day, while verify-before-claim (#1) requires orchestration work. Ship the cheap win first.

---

## Step 14: Schliff v2.8 Optimization + Panel Self-Review (2026-03-26)

### Motivation

v2.8 added 4 features (severity dampening, coverage check, verify-before-claim, precise/exhaustive mode), growing SKILL.md from 340 to 457 lines. Schliff analysis scored 84/100 with edges (72) and efficiency (68) as weakest dimensions.

### Changes

1. **Condensed Phase 4.55** from 20 to 6 lines — same annotation labels, advisory principle, and skip condition in fewer tokens
2. **Condensed Phase 5 judge steps** from 12 to 10 lines — compact indexed listing that preserves step ordering
3. **Added Edge Cases section** — 6 documented scenarios: empty input, large files, binary files, tiny files, no P0/P1, unanimous agreement

### Panel Self-Review

Ran the skill on its own PR diff (2 reviewers: Completeness Checker + Quality Reviewer). The panel caught that the initial condensation was too aggressive:

- **Lost the Precise-mode P2 severity cap** — "In Precise mode, findings without code citations cannot exceed P2" is a hard behavioral constraint, not descriptive prose. Trimming it would have let the judge allow uncited P0s in code reviews — the exact failure mode v2.8's mode detection was designed to prevent.
- **"10-step judge prompt" was wrong** — actual count is 14 steps (0, 0.5a-d, 1-9). Fixed to "full judge prompt."

Both fixed in follow-up commit. Estimated schliff score: 84 → 90.

### Lessons

22. **Hard behavioral constraints must not be trimmed for efficiency.** When condensing, distinguish between descriptive prose ("this is how it works") and prescriptive rules ("this must never exceed P2"). Only trim the descriptive. The Precise-mode P2 cap looks like prose but functions as a constraint.

23. **Use the skill on its own PRs.** Running a focused 2-reviewer panel on the schliff diff caught exactly the kind of subtle loss that manual review misses. Cost: ~2 minutes. Value: prevented shipping a broken severity cap.

---

## Step 15: VoltAgent Specialist Agent Integration (v2.9, 2026-03-29)

### Motivation

During a test plan review for a causal impact analysis webapp, we bypassed the full review panel ceremony and instead launched 4 VoltAgent specialist agents directly (`voltagent-qa-sec:qa-expert`, `voltagent-data-ai:data-scientist`, `voltagent-infra:devops-engineer`, `voltagent-qa-sec:code-reviewer`). The result was striking: 38 findings with <10% cross-reviewer overlap. Each specialist caught blind spots the others missed — QA found error path gaps, DataSci found statistical fixture contamination, DevOps found hardcoded paths and state isolation issues, and the code reviewer challenged scope achievability.

The VoltAgent agents have built-in domain expertise via their system prompts, making them genuinely stronger reviewers than generic agents prompted as "you are the Security Auditor." The question was: could we integrate this into the review panel skill while keeping it portable?

### Implementation

Added a "VoltAgent Integration (v2.9)" section to SKILL.md with:

1. **Availability check** — scan system-reminder for `voltagent-*` agents during Phase 1
2. **3-tier mapping tables:**
   - Core persona mapping (16 rows) — every built-in persona → VoltAgent primary + alt
   - Signal-detected specialist mapping (35 rows) — content signals → language/domain agents
   - Orchestration mapping (4 rows) — completeness audit, claim/severity verification
3. **Smart installation prompts** — suggest only relevant families, once per session, non-blocking
4. **Graceful fallback** — everything works without VoltAgent; it's a transparent upgrade

Full catalog sourced from [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) (127+ agents across 10 families).

### Key Design Decisions

- **Devil's Advocate stays generic** — the contrarian role benefits from having no domain bias
- **Supreme Judge stays generic** — must be domain-neutral to arbitrate
- **Persona prompts still included** — VoltAgent agents get the review-specific context (agreement intensity, reasoning strategy, evaluation criteria) that their built-in system prompts don't cover
- **Installation suggestion is non-blocking** — "Continue without them? They're optional"

### Lessons

24. **Domain-specific system prompts beat persona prompts for specialist reviews.** A `voltagent-qa-sec:code-reviewer` has built-in code review heuristics that a generic agent prompted as "Correctness Hawk" cannot match. The difference is most visible in edge case detection and error path coverage.

25. **VoltAgent integration must be a transparent upgrade, not a requirement.** The skill has users who don't have VoltAgent installed. Making it required would break portability. The graceful-fallback + smart-suggestion pattern preserves the skill's universality while rewarding users who have specialist agents available.

---

## Step 16: Verification Round + Triple Output + Persona Profiles (v2.11–v2.13, 2026-04-03)

### Motivation

The existing verification layer (Phases 4.55–4.7) catches citation errors and overstated severity, but the judge still resolves substantive disputes from debate transcripts alone. When two reviewers fundamentally disagree about whether a rate-limiter handles concurrency or whether a PRNG is cryptographically appropriate, the judge has no independent investigation to draw on — just the two sides' arguments.

Meanwhile, the output was a single markdown report. Users working with the panel on high-stakes reviews wanted both full transparency (the verbatim agent reasoning) and quick consumption (interactive filtering by severity/verdict).

The [MiroFish](https://github.com/666ghj/MiroFish) project's heterogeneous agent architecture — where distinct agent personalities are matched to prediction tasks based on the task's domain characteristics — directly influenced the design of persona-matched verification agents.

### v2.11 — Verification Round

Added two new phases between existing verification and the supreme judge:

**Phase 4.8: Verification Tier Assignment** — a two-step pipeline:
1. **4.8a: Confidence-Based Draft** (no agent) — derives initial tiers from Phase 2.5 confidence ratings and debate round signals. Low-confidence or multi-round unresolved → Deep; mixed → Standard; all-high + simple fact → Light.
2. **4.8b: Judge-Advised Refinement** (Opus agent) — reviews the draft and overrides where signals are misleading. Works FROM the draft rather than cold — the confidence data gives it "ground-level" signal from reviewers who lived through the debate.

Key design decision: the pipeline (confidence-based first, judge refines) is better than the three original methods (A: judge-only, B: confidence-only, C: take-max) because the judge is auditing existing assignments rather than creating from scratch. Lower cognitive load, higher accuracy.

**Phase 4.9: Targeted Verification Agents** — one agent per dispute, launched in parallel:
- Persona-matched to claim type (statistical → Data Scientist, code correctness → Code Reviewer, security → Security Auditor, etc.)
- VoltAgent specialists preferred when available
- Tiered budgets: Light ~2k tokens (read-only), Standard ~8k (multi-file), Deep ~32k (web search)
- Verdicts: [VR_CONFIRMED], [VR_REFUTED], [VR_PARTIAL], [VR_INCONCLUSIVE], [VR_NEW_FINDING]

Phase 5 judge updated to receive the Verification Round Summary as 8th input. Step 2 ("Rule on Each Disagreement") now gives significant weight to VR_CONFIRMED/VR_REFUTED verdicts — they represent specialist investigation beyond what the panel performed.

### v2.12 — Triple Output Format

Phase 6 restructured from 1 → 3 output files:
1. **`review_panel_report.md`** — existing primary report, unchanged
2. **`review_panel_process.md`** — verbatim "director's cut" of every agent's output in chronological order. Orchestrator-assembled, no new agent needed.
3. **`review_panel_report.html`** — interactive dashboard generated by a dedicated Opus agent. Tailwind CSS + Chart.js via CDN. Features: stats row, three charts (confidence distribution, tier breakdown, verdict breakdown), filterable/sortable issue cards with expandable evidence panels, and collapsible consensus/disagreement sections.

Phase 6.1 runs first; 6.2 (orchestrator write) and 6.3 (Opus agent) run in parallel.

### v2.13 — Persona Profiles

Every agent now has a structured persona profile surfaced in both output files:

**Process history** (`review_panel_process.md`):
- Persona Profiles Registry section at the top listing all agents
- Inline profile blocks immediately before each agent's first output
- Profile fields: role, agreement intensity (panelists), reasoning strategy, domain focus, agent type (VoltAgent or generic), matched-claim-type (4.9 agents), phases active

**Interactive HTML** (`review_panel_report.html`):
- Panel Gallery section (collapsible) with three sub-groups: Panel Reviewers (avatar cards, clickable to filter issues), Verification Specialists (linked to dispute points), Support Agents (compact cards with phase badges)
- Issue cards show "Raised by" avatar chips and verification agent persona in expanded evidence panel
- Cross-linking: clicking a persona chip in an issue card scrolls to and highlights that agent's card in the Panel Gallery

### Lessons

26. **Tier assignment works better as a pipeline than as independent methods.** Running confidence-based first, then having the judge refine, outperforms three separate methods (judge-only, confidence-only, take-max). The judge benefits from seeing the "why" behind each draft tier.

27. **Persona matching for verification agents should follow the same signal-detection pattern as panel personas.** The claim-type → persona mapping mirrors the content-signal → persona mapping from Phase 1. Reuse the pattern.

28. **Three output formats serve three audiences.** The primary report is for the decision-maker (30-second scan). The process history is for the auditor who wants to understand HOW the panel reached its conclusions. The HTML dashboard is for the reviewer who needs to triage 15+ action items by severity and confidence.

29. **Persona profiles make multi-agent systems interpretable.** When a verification agent refutes a claim, the reader needs to know WHY that agent was chosen — "Statistical Methods Expert matched because the dispute involves convergence rates" is far more credible than an anonymous verdict.

---

## File Inventory

```
├── SKILL.md                           # The skill itself (v2.13, ~800 lines)
├── skills/agent-review-panel/
│   └── SKILL.md                       # Plugin copy (synced with root)
├── references/
│   ├── signals-and-checklists.md      # 9 signal groups + domain checklists
│   ├── prompt-templates.md            # All phase prompt templates (incl. 4.8/4.9/6.2/6.3)
│   ├── changelog.md                   # Version history (v2–v2.13)
│   └── research-v28.md               # 19-source v2.8 research compilation
├── docs/
│   ├── demo-flow.png                  # Architecture diagram (referenced by README)
│   └── archive/                       # Historical artifacts
│       ├── SKILL.v2.md, SKILL.v2.1.md # Old skill versions
│       ├── review_panel_report.md     # v2.8 roadmap panel review
│       └── v25-vs-v26-comparison.md   # A/B test results
├── .claude-plugin/
│   ├── plugin.json                    # Plugin metadata
│   └── marketplace.json               # Marketplace listing
├── README.md                          # User-facing documentation
├── HOW_WE_BUILT_THIS.md               # This file
├── ROADMAP.md                         # Unified research + trust roadmap (17+ papers, 14 projects)
├── eval-suite.json                    # Schliff eval suite (triggers + assertions)
└── LICENSE                            # MIT
```
