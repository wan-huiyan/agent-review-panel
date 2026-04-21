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

## Step 17: Data Flow Trace + Multi-Run Union + Force Opus (v2.14, 2026-04-07)

### Motivation

Two identical panel runs on the same Schuh webapp (v2.10, `epic-poincare` and `thirsty-nobel` worktrees) produced only ~30% finding overlap. Each run missed a different P0 bug the other caught. A consistency analysis identified four root causes:

1. **LLM-driven content classification produces different persona compositions across runs.** The same "webapp + methodology" scope was classified differently in each run, cascading into entirely different finding profiles (Correctness Hawk vs Code Quality Auditor as the lead reviewer).
2. **Single-run coverage catches only ~60-70% of discoverable issues.** Research on independent code review (Dunsmore et al., 2000) puts the inter-reviewer overlap at 20-40% — consistent with our observation.
3. **Composition/seam bugs require dedicated tracing.** The `apply_date_mask` + `prep_df` bug — where function A correctly removes masked Nov-Jan rows and function B correctly reindexes with `fillna(0)`, silently reintroducing the masked rows as zero-revenue days — is structurally invisible to reviewers who read each function in isolation. No prior phase targeted this bug class.
4. **Silent model mixing via VoltAgent.** The skill said "all agents use opus" at lines 60 and 422 of SKILL.md, but the VoltAgent Step 4 launch instructions at lines 410-412 omitted `model: "opus"`, causing reviewers to fall through to the VoltAgent agent's default model (potentially sonnet or haiku). Reasoning depth varies by model, so this introduced invisible cross-run variance on top of persona variation. This was a latent bug introduced in v2.9 and went undetected for 6 minor releases.

### Implementation

**Phase 2: Data Flow Trace.** A dedicated agent traces data through critical path(s) BEFORE reviewers begin, producing a structured Data Flow Map injected into every reviewer's Phase 3 prompt. Uses Meta's semi-formal certificate prompting (arXiv:2603.01896, 2026, 78%→93% accuracy gain): at each function boundary, the agent produces

```
FUNCTION: {name} ({file}:{line})
INPUT_SCHEMA: {types, constraints, tainted fields}
TRANSFORM: {what the function does + external calls}
OUTPUT_SCHEMA: {return type, derived fields, invariants}
COMPOSITION_CHECK: {does OUTPUT_SCHEMA satisfy next INPUT_SCHEMA?}
INVARIANT_STATUS: {preserved or violated — violations flagged as P0 candidates}
```

Five mandatory invariant checks at every boundary: schema preservation, transform/back-transform completeness, row count stability, null semantics, temporal consistency. Three user-selectable tiers: Standard (default, single top-ranked path, ~5 min), Thorough (top 3 paths + transform completeness, ~15 min), Exhaustive (all paths, no token limit — aims to catch all bugs). Skipped for pure docs/plans or code with no detectable transforms.

**Multi-Run Union Protocol + Phase 16: Merge.** User invokes `--runs N` or "run 3 times and merge" to execute the panel N times with rotated persona compositions:

- **Run 1:** Standard content-type base set + signal specialists
- **Run 2:** Complementary set (Code Quality Auditor, Performance Specialist, Methodology Analyst, DA)
- **Run 3:** Adversarial-heavy (3 Devil's Advocates with different reasoning strategies — analogical, adversarial simulation, failure mode enumeration — plus 1 Correctness Hawk)
- **Run 4+:** Cycle through 1-3 with shuffled signal specialists

**Key rule:** content classification runs ONCE in Run 1 and is FIXED for all subsequent runs. Phase 2 also runs once and is cached. This eliminates the primary source of cross-run non-determinism (LLM-driven classification) while preserving the benefits of persona rotation.

Phase 16 Merge Agent deduplicates findings by location + bug class (same file + same function OR lines within 10, AND same bug class), scores stability as `[K/N RUNS]`, uses HIGHEST severity when runs disagree (conservative), resolves judge divergence (>2 point spread) with independent assessment. Single-run findings are NOT demoted — they often represent unique persona insights.

**Force `model: "opus"` on all launches.** Three edits to SKILL.md (Dependencies section, Phase 1 VoltAgent Step 4, Core Persona Mapping intro) plus one to `references/prompt-templates.md`. New manifest-consistency test greps all `subagent_type:` occurrences and asserts `model: "opus"` co-occurs on the same line.

**Integer phase renumbering.** All phases renumbered from decimal hierarchy (1, 2, 2.5, 3, 3.5, 4, 4.5, 4.55, 4.6, 4.7, 4.8, 4.8a, 4.8b, 4.9, 5, 6, 6.1, 6.2, 6.3) to sequential integers (1–16). Phase 15 retains sub-phases 15.1/15.2/15.3 as parent "Output Generation" (parallel output generation, not sequential pipeline steps). Phase 12 retains sub-parts 12a and 12b (two-step tier assignment pipeline — confidence-based draft + judge-advised refinement).

### Testing

All 380 tests pass (up from 363) — 13 new tests for v2.14 coverage:

- **4 new manifest-consistency tests:** 16 integer phases present, `subagent_type` + `model: "opus"` co-occurrence on every real launch, no decimal phases remain (except allowed 15.x), SKILL.md mentions v2.14 features
- **v2.14 category validation** in eval-suite-integrity (positive-v214, negative-v214, edge-v214)
- **v2.14 coverage describe block** (3 tests: positive triggers exist, negative triggers exist, triggers cover both multi-run and data flow trace features)
- **6 new eval-suite triggers** (4 positive, 2 negative)

### Lessons

30. **Independent test coverage lags silently.** The v2.9 VoltAgent integration omitted `model: "opus"` from launch calls, and this went undetected for 6 minor releases because there was no test covering the invariant. The fix was a ~20-line regex-based test that would have caught the bug in v2.9. **Rule:** when adding new launch syntax (subagents, specialist agents, etc.), add a test that asserts the invariant you intend — not just that the launch syntax works.

31. **Composition bugs live at function boundaries.** The entire class of bugs where two individually-correct functions produce incorrect results together is structurally invisible to per-function review. Dedicated data flow tracing catches them; adversarial debate does not. The Data Flow Tracer is the biggest coverage improvement since the Completeness Auditor (v2.0).

32. **Content classification non-determinism cascades.** One LLM decision at Phase 1 ("is this pure code or mixed content?") cascades through the entire pipeline because persona selection depends on it. Multi-Run Union mitigates by rotating personas directly (no classification per run). A future v2.16+ could eliminate this entirely with rule-based classification.

33. **Hand-in-hand data enrichment + rendering spec is required to prevent agent compliance drift.** The v2.13 HTML prompt already specified expandable issue cards with a "▶ View evidence" button. But the schema only populated `fullEvidence` for verified findings, so for the other 19 findings the HTML agent had nothing to expand — and it silently omitted the expand button entirely. When requiring agents to render rich UI, the DATA must also be required (required fields, empty placeholders OK) so agents can't shortcut the spec. This lesson directly motivated v2.15's "all 10 sections always present, empty ones show placeholders" rule.

---

## Step 18: Expandable Issue Cards in Phase 15.3 HTML Report (v2.15, 2026-04-07)

### Motivation

A sample v2.13 HTML output (`review_panel_report_consolidated.html` in the nice-shtern worktree) rendered 22 flat issue cards with no expand mechanism. The prompt already specified `▶ View evidence` — but the agent omitted it because the schema lacked rich data for non-verified findings (see lesson 33 above).

Process history (`review_panel_process.md`) had ~600 lines of full narratives, debate transcripts, and VR agent outputs per review — all of which was available in the skill's output but NEVER passed to the HTML agent. The HTML was rendering from the summarized `review_panel_report.md` only.

### Implementation

**Schema extension.** 8 new REQUIRED fields per action item in the Phase 15.3 prompt:

- `narrative` — full multi-paragraph reviewer reasoning (verbatim, not summarized)
- `codeEvidence` — array of `{file, lineRange, language, snippet, caption}`
- `reviewerRatings` — per-reviewer severity + reasoning
- `debateTranscript` — round-by-round Phase 5 exchanges
- `judgeRuling` — full Phase 14 reasoning + severity-change explanation
- `fixRecommendation` — proposed change + before/after code + regression test + blast radius + effort
- `crossRefs` — related findings with relationship labels (root-cause, same-class, depends-on, blocks)
- `priorRuns` — meta-review comparison across prior runs

Critical rule: fields are required-but-possibly-empty. Empty arrays or null values are acceptable, but the field must be present. The HTML renderer shows "No {section} data" placeholders for empty sections so every card has consistent structure. This prevents the v2.13 compliance gap from recurring — agents can't skip sections with no data because the spec demands the placeholder.

**Phase 15.2 as Reference Input.** The HTML agent now receives the full Phase 15.2 process history (`review_panel_process.md` content) alongside the structured summary. It extracts verbatim narratives, debate exchanges, and judge rulings per finding. Token cost: ~10–20KB per review. This is the critical bridge — the data was always generated, just never passed to the HTML agent.

**10-section accordion layout.** Each card is a native `<details>` element. The `<summary>` contains the collapsed card header. Expanding reveals a nested accordion of 10 `<details>` sections (open by default):

1. 📖 Narrative
2. 📄 Code Evidence (Prism.js-highlighted with file:line headers)
3. 👥 Raised by (per-reviewer rating + reasoning grid)
4. 🔍 Verification Trail (full VR agent output if verified)
5. 💬 Debate (round-by-round transcript if disputed)
6. ⚖️ Judge Ruling (full reasoning + severity-change explanation)
7. 🛠️ Fix Recommendation (proposed + before/after + test + blast radius + effort)
8. 🔗 Cross-references (clickable scroll-to-target with pulse highlight)
9. 🏷️ Epistemic Tags (hover tooltips explaining each label)
10. 📊 Prior Runs (meta-review comparison table)

**Card-level UX features.** Deep-link support (`#issue-A1` auto-opens), keyboard navigation (↑/↓/Enter/Home/End/`/`), expand-all / collapse-all buttons, print-friendly `@media print` CSS (forces all details open, inverts theme, hides charts), soft 500KB size cap with optional slim mode.

**New CDN dependency:** Prism.js (prism-tomorrow theme + autoloader plugin) for code syntax highlighting. Third CDN alongside Tailwind and Chart.js. Graceful fallback to unstyled `<pre>` if unreachable.

### Testing

All 393 tests pass (up from 380) — 13 new tests for v2.15 coverage:

- **4 new manifest-consistency tests:** Phase 15.3 spec documents all 10 expandable card sections, 8 new schema fields present, Prism.js CDN documented, SKILL.md mentions v2.15 features
- **v2.15 category validation** in eval-suite-integrity (positive-v215, negative-v215, edge-v215)
- **v2.15 coverage describe block** (3 tests: positive triggers exist, negative triggers exist, triggers mention expandable/deep-detail features)
- **3 new eval-suite triggers** (2 positive, 1 negative — the negative catches "expand my code" debugging context, not expandable cards)

### Sample regenerated output

Hand-rendered a new demo HTML at `review_panel_report_consolidated_v215.html` (190KB, 2370 lines — up from 51KB, 821 lines for v2.13) with 25 expandable cards:

- 3 fully populated (A1, B1, C1) with all 10 accordion sections showing real extracted content from the process history
- 22 with placeholder accordion content demonstrating consistent structure even when source data is absent
- All v2.15 features wired up: Prism.js, deep-linking, keyboard navigation, expand/collapse all, print styles, cross-references

### Lessons

34. **Required-but-possibly-empty fields beat optional fields for forcing compliance.** When a rendering agent has a choice between "populate rich UI with empty data" and "skip the rich UI entirely", agents reliably choose "skip". Making fields required with empty-placeholder rendering removes the choice — the agent must produce the structure, even if the data is empty. This is the architectural fix for lesson 33.

35. **Cross-phase data routing is an underappreciated fix.** Phase 15.2 generates verbatim agent reasoning. Phase 15.3 renders HTML. For 3 versions (v2.12–v2.14), the two phases ran in isolation — Phase 15.3 never saw Phase 15.2's verbatim content. The fix was not to regenerate data or rewrite agents, but simply to route Phase 15.2's output into Phase 15.3's input. Before assuming you need new data generation, check whether existing data is being thrown away at phase boundaries.

36. **Native `<details>` is the right primitive for expandable UI in self-contained HTML.** It requires zero JavaScript for the expand/collapse behavior, works in print media queries (with `details > *:not(summary)` forced open), keyboard-accessible by default (Tab + Enter/Space), and nests cleanly for accordion patterns. The alternative — JS-driven toggle state — adds framework dependencies and print-unfriendly state management.

---

## Step 19: Canonical Plugin Layout + Drift Cleanup (v2.16, 2026-04-07)

### Motivation

Two interlocking failures surfaced once the repo started getting dogfooded by other users:

1. **Plugin install was broken.** The repo structure predated the Claude Code plugin marketplace convention. `marketplace.json` lived at the repo root, `plugin.json` lived at `.claude-plugin/plugin.json`, and the marketplace `source` field was `"."`. Claude Code silently ignored the root-level `marketplace.json` and rejected `"source": "."` as `Invalid schema: plugins.0.source`. Users running `/plugin marketplace add wan-huiyan/agent-review-panel` got nothing useful. The install had to be restructured to the canonical `plugins/<name>/` layout.

2. **Silent version drift across 4+ files.** `plugin.json` was the authoritative version, but `package.json`, `eval-suite.json`, and two version strings inside `SKILL.md` (the H1 header and a Phase 15.3 HTML footer instruction) drifted every time a PR bumped `plugin.json` without sweeping the other locations. PR #20's dogfooding caught the drift by accident — users saw a footer reading "v2.15" on reports generated by v2.16 code. The test suite had no cross-version assertions, so CI couldn't catch it.

### Implementation

**PR #18 — Canonical layout.** Restructured to `plugins/agent-review-panel/SKILL.md` + `plugins/agent-review-panel/.claude-plugin/plugin.json`. Marketplace manifest moved to `.claude-plugin/marketplace.json` with `"source": "./plugins/agent-review-panel"`. Marketplace name became owner-prefixed (`wan-huiyan-agent-review-panel`) for uniqueness across the wan-huiyan marketplace family. Added `$schema` + top-level `description`. Updated the existing `manifest-consistency.test.mjs` and `trigger-classification.test.mjs` with canonical discovery helpers that find `plugins/<name>/.claude-plugin/plugin.json` anywhere under `plugins/`.

**PR #19 — Install-command fix + stale-clone docs.** PR #18's marketplace rename broke the README's install commands — `@agent-review-panel` no longer resolved anywhere. Fixed all three broken install blocks (Quick Start, Installation §, Uninstalling §). Added a new `### Updating to the latest version` subsection with the standard update flow, a verification command using a `*` glob for the cache-path version segment, a clean-reinstall fallback, and — critically — a stale-local-clone troubleshooting block. The stale-clone gotcha was the root cause of two users that week getting degraded output labeled "v2.15" but structurally generated by older code: Claude Code loads `~/.claude/skills/` BEFORE the marketplace cache, so a pre-marketplace `git clone` silently shadows every plugin update.

**PR #20 — Dedupe + rebrand + version drift cleanup.** Deduplicated the install commands (the same 2-line block appeared in both Quick Start AND the "Claude Code marketplace (recommended)" subsection). Added a new `### Requires Claude Code` subsection at the top of Installation §. Rebranded `skill` → `plugin` at the product level (badge, tagline, blockquote) while leaving body mentions of "skill" alone where they correctly refer to the inner capability. Swept the 4 drifted version references: `package.json` 2.15.0 → 2.16.0, `eval-suite.json` 2.15.0 → 2.16.0, SKILL.md H1 header `v2.15` → `v2.16`, SKILL.md Phase 15.3 HTML footer instruction `"Agent Review Panel v2.15"` → `"Agent Review Panel v2.16"`.

**PR #21 — Cross-version consistency assertions.** Added 4 new tests to `manifest-consistency.test.mjs`, all implemented as conditional `it()` blocks that only fire when the relevant file/field exists:

1. `eval-suite.json` version matches `plugin.json` version
2. `package.json` version matches `plugin.json` version
3. `SKILL.md` H1 header `v<major>.<minor>` matches `plugin.json` semver major.minor
4. `SKILL.md` HTML footer instruction `v<major>.<minor>` matches `plugin.json` semver major.minor

Red-test validation: drifted `plugin.json` to `9.9.9`, ran `npm run test:manifest`, all 5 version-matching tests failed simultaneously with clear error messages. Restored, reran, all pass. Had these tests existed before PR #18, the version drift would have been caught in PR #18's CI run, not discovered weeks later during dogfood.

### Lessons

37. **Structural compliance with a downstream tool's schema beats organic layout.** The pre-PR-#18 repo layout was "organic" — it grew from a flat skill into a plugin by accretion, with files in whatever location was convenient at the time. The Claude Code plugin marketplace has a canonical layout spec; the moment we didn't match it, the install broke silently. Lesson: when shipping a plugin for a host platform, read the host's canonical layout spec FIRST and restructure before the first release, not after the first install bug report.

38. **Silent drift is invisible without cross-version assertions.** Four version strings drifted across PR #18 and nobody noticed for two weeks. The test suite had per-file structural validation but no cross-file invariants. Any time you have the same value in multiple files (version, plugin name, schema version), write a test that fails when they diverge. The test is one `assert.equal` per pair; the cost of NOT having it is users seeing reports labeled with a stale version number.

39. **Stale local clones shadow marketplace updates.** Claude Code's skill-resolution order puts `~/.claude/skills/<name>/` BEFORE `~/.claude/plugins/cache/<marketplace>/<plugin>/`. A user who cloned the repo before marketplace support existed — or who cloned it for dev and forgot — will be pinned to whatever version was cloned, invisibly. The fix is a diagnostic command (`ls ~/.claude/skills/<name>`) in the README's update-troubleshooting section, because no version-verify command can detect a shadow you don't know exists.

---

## Step 20: Multi-Plugin Marketplace Bundle (v2.16.1, 2026-04-08)

### Motivation

`plan-review-integrator` was published as a separate repo (`wan-huiyan/plan-review-integrator`) that took `agent-review-panel`'s output as input — the review→integrate half of a two-step workflow. Keeping them in separate marketplaces meant:

- Install-command confusion: two different `@<marketplace-name>` suffixes to remember
- Version drift: each repo had its own release cadence; upstream-schema compatibility could silently break
- Doubled CI and test infrastructure; two CHANGELOGs to maintain
- The `@wan-huiyan-agent-review-panel` marketplace name was a mouthful and PR #19 had already had to fix README commands after it changed once

The solution: bundle `plan-review-integrator` INTO `agent-review-panel`'s repo as a second plugin under the same marketplace. Take the opportunity to rename the marketplace to something shorter while users will already be uninstalling + reinstalling.

### Implementation

**Marketplace name.** `wan-huiyan-agent-review-panel` → `plugin` (at v2.16.1). The install command became `/plugin install <name>@plugin` — memorable, short, no owner prefix to typo. *(See Step 21: `plugin` collided with unrelated marketplaces and was renamed back to `agent-review-panel` at v2.16.2.)*

**Bundled plugin.** `plugins/plan-review-integrator/` added alongside `plugins/agent-review-panel/`. The upstream `wan-huiyan/plan-review-integrator` repo got archived with a pointer README. plan-review-integrator bumped 1.4.0 → 2.0.0 to mark the marketplace move (a breaking change for the install URL, not plugin behavior). Its eval-suite had drifted from `plugin.json` since the first commit (`eval-suite.json` was at 1.0.0 while `plugin.json` was at 1.4.0) — fixed in the same commit by bumping eval-suite to 2.0.0 in lockstep.

**Per-plugin eval-suite layout.** `eval-suite.json` moved from repo root to `plugins/agent-review-panel/eval-suite.json`. New `plugins/plan-review-integrator/eval-suite.json` added (migrated from the upstream standalone repo). This was necessary because two plugins can't share a root-level eval-suite — each plugin has its own trigger set, assertion domain, and version cadence.

**Multi-plugin test framework refactor.** This was the highest-risk piece. `tests/manifest-consistency.test.mjs` and `tests/trigger-classification.test.mjs` were single-plugin: they discovered the first `plugins/<name>/.claude-plugin/plugin.json`, validated it, walked away. After the refactor both tests iterate every plugin independently:

- New `discoverPlugins()` enumerates `plugins/*/`, builds a per-plugin object with `pluginJson`, `skillMd`, `evalSuite`, `nestedSkillMd`. Legacy fallback for repos that still keep these at root.
- Per-plugin assertion blocks wrap every plugin in its own `describe(\`Plugin: \${name}\`)` with plugin.json + eval-suite + SKILL.md checks.
- `marketplace.json` assertions iterate every entry in `plugins[]`, match each against a discovered plugin by name, validate version + source path independently. New invariant: marketplace entry count must match discovered plugin count (catches forgetting to add an entry when adding a plugin folder).
- PR #21's 4 cross-version assertions are now applied **per-plugin**. The H1 header and HTML footer checks skip cleanly when a plugin's SKILL.md doesn't carry that pattern — `plan-review-integrator` has no HTML footer instruction, so its block skips that single assertion while still running the H1 check.
- ARP-specific tests (`eval-suite-integrity`, `behavioral-assertions`, `report-structure`, `golden-file`) stay agent-review-panel-specific. They were never generic and shouldn't be — they assert on Phase 3 / Phase 5 / v2.9 / v2.14 / v2.15 features that only this plugin has. Their `eval-suite.json` path was updated to `plugins/agent-review-panel/eval-suite.json`.

### Testing

All 352 tests pass (up from 308 at the PR #21 baseline) — +44 tests from `plan-review-integrator` manifest + trigger coverage.

**Red-test validation (critical for a refactor this structural):** deliberately drifted each plugin's `plugin.json` version to `9.9.9` independently and reran `npm run test:manifest`:

| Drift target | Failures | Which assertions caught it |
|---|---|---|
| `plugins/plan-review-integrator/.claude-plugin/plugin.json` | **3** | eval-suite cross-version, marketplace entry version, SKILL.md H1 header |
| `plugins/agent-review-panel/.claude-plugin/plugin.json` | **5** | eval-suite + marketplace + package.json + H1 header + HTML footer instruction |

Each plugin's drift was caught **independently** — the refactor did not silently collapse to validating only the first plugin. Restored both files; 352/352 passed.

### Lessons

40. **Bundle related plugins before they diverge.** `plan-review-integrator` was separate from `agent-review-panel` for six weeks. In that time its eval-suite drifted from its own plugin.json (1.0.0 vs 1.4.0), the install command changed (PR #19's marketplace rename), and compatibility docs for the producer/consumer schema only existed in one of the two repos. Had they been bundled from day one, all three problems would have been impossible — the same CI, the same version sweep, the same schema contract live in one place. If two skills are in a strict producer/consumer relationship, default to one repo/marketplace and split only when there's a reason to.

41. **Multi-plugin test refactors need red-test validation, not just green-test confirmation.** A bug in the new `discoverPlugins()` could silently collapse validation to only the first plugin, and the green test run would STILL pass. The only way to be sure every plugin is being validated independently is to deliberately break each one and verify the failure count matches the number of assertions you expect to fire for that plugin. Green-passing tests prove nothing about coverage scope in a structural refactor.

42. **Plugin-specific assertions should skip cleanly, not hard-code plugin names.** PR #21's H1 header assertion used a regex hard-coded to `# Agent Review Panel v<X>.<Y>`. Generalizing to multi-plugin meant rewriting it to match any `^#\s+.+?\sv(\d+)\.(\d+)\b` — the same check, but title-agnostic. For the HTML footer instruction (which only `agent-review-panel` has because only it renders HTML reports), the generalized check skips cleanly when the pattern isn't present in the SKILL.md at all. The rule: when generalizing a plugin-specific assertion for a multi-plugin framework, make it skip-on-absent rather than fail-on-absent — otherwise it becomes a coupling between the assertion and the one plugin that happens to match it.

---

## Step 21: Hardening Between v2.16.2 and v2.16.5 (2026-04-08 → 2026-04-19)

The two weeks after the multi-plugin bundle shipped surfaced four user-visible issues that didn't warrant their own Step but compounded into a pattern worth documenting.

**v2.16.2 (2026-04-08) — Marketplace rename-back + plugin.json skills-field hotfix.** The `plugin` marketplace name from v2.16.1 (intended to be short and memorable) turned out to collide with other users' marketplaces — "install from `@plugin`" isn't discoverable if half the plugin ecosystem calls theirs the same. Renamed back to `agent-review-panel` (commit `00e2149`). Simultaneously: PR #18's canonical layout move had silently broken all marketplace installs because `plugins/<name>/.claude-plugin/plugin.json` wasn't declaring a `skills` field, and Claude Code's plugin loader only auto-discovers `skills/<name>/SKILL.md` — the root-level `SKILL.md` was never registered. Users who had a pre-PR-#18 manual clone at `~/.claude/skills/agent-review-panel/` didn't notice because the loose-skill install shadowed the broken plugin (same stale-clone gotcha PR #19 documented). PR #24 fixed it by adding `"skills": ["./"]` to plugin.json. Also fixed the README's `/agent-review-panel` slash-command references to the namespaced `/agent-review-panel:agent-review-panel` form.

**v2.16.3 (2026-04-09) — Phase 11 external-domain web verification.** Motivated by a real audit (PUMA GA4) where all 4 reviewers unanimously P0'd "50 months retention = GA4 360" without verifying whether 50 months is even a valid GA4 setting. The Phase 13 verification round only triggers on **disputes**, so consensus findings with shared-model blind spots bypass it entirely. Fix: Phase 11 severity-verification now classifies each P0/P1 as external-domain-claim or internal, and runs a bounded web search (2 queries × 5 claims max) for external claims. New labels `[WEB-VERIFIED]`, `[WEB-CONTRADICTED]` (auto-demotes 1 severity level), `[WEB-INCONCLUSIVE]`.

**v2.16.4 (2026-04-15) — Phase 15.3 reliability fix (PR #26).** Phase 15.3 (HTML report) was silently failing in most runs because the orchestrator's context window was near capacity after 14 phases. The subagent launch would return without writing the file. Four-part fix: (1) sequential 15.1→15.2→15.3 (was parallel — Phase 15.3 now runs AFTER Phase 15.2 so its agent can read 15.2's output from disk instead of receiving it in-context), (2) disk-reading data strategy (orchestrator prompt drops from 700+ lines to ~10 lines — the agent reads `review_panel_report.md`, `review_panel_process.md`, and the rendering spec from `references/prompt-templates.md` directly), (3) mandatory verification gate before completion (`ls -la` the 3 output files, auto-retry once if HTML missing), (4) manual recovery path (user can say "generate the HTML review report" to re-launch). Also unified the version string in SKILL.md's H1 header and HTML footer instruction — both now must match the full semver from `plugin.json`, not the version that introduced the HTML features.

**v2.16.5 (2026-04-19) — Skills layout for Claude Code ≥2.1.112 (PR #30, first external contribution from @okuuva).** Claude Code 2.1.112 hardened its plugin-manifest validator and rejected both `skills` field values the plugin had historically used: `["./"]` fails with *"Path escapes plugin directory"*, `["SKILL.md"]` fails with *"Validation errors: skills: Invalid input"*. Neither value was portable. Fix: restructure to the canonical nested layout (`plugins/<name>/skills/<name>/SKILL.md`) and drop the `skills` field from `plugin.json` entirely, letting auto-discovery handle it. This also had the benefit of being fully spec-compliant — no manifest declarations needed for the default layout.

**Alongside these functional fixes: a plugin rename (v2.16.2) that was later reverted (v2.16.6).** `agent-review-panel` → `roundtable` for the install handle (commit `a522b00`) at v2.16.2; then `roundtable` → `agent-review-panel` at v2.16.6. The v2.16.2 rename was motivated by wanting a shorter, more memorable install token — `roundtable@agent-review-panel` instead of the doubled `agent-review-panel@agent-review-panel`. The v2.16.6 revert was motivated by the realization that the short name introduced three-layer naming divergence (skill=`agent-review-panel`, plugin=`roundtable`, marketplace=`agent-review-panel`) that made every piece of user documentation more complex for a single-character-count win. Collapsing all three layers to the same name produces `agent-review-panel@agent-review-panel` and `/agent-review-panel:agent-review-panel` — doubled but self-explanatory.

### Lessons

43. **Rename-back is cheaper than living with a bad name — corollary: don't introduce naming divergence across layers without a strong reason.** v2.16.1's `plugin` marketplace name was reverted three days later (colliding with ecosystem defaults). v2.16.2's `roundtable` plugin rename was reverted two weeks later — it was shorter but introduced skill/plugin/marketplace divergence that made every doc page more complex. The `agent-review-panel@agent-review-panel` doubled form is uglier but explains itself. Rule of thumb: if the plugin does one thing and the skill inside it is the thing, name them the same and let the `<plugin>:<skill>` namespacing be visibly redundant. Clever short names cost more in documentation than they save in typing.

44. **The `skills` field in plugin.json is a sharp edge.** Between v2.16.2 (`["./"]` added via PR #24 to make SKILL.md load at plugin root) and v2.16.5 (field dropped entirely, SKILL.md moved to nested subdir via PR #30), the field was modified four times in three weeks — every change breaking something. The real fix was structural: stop declaring the field and use the auto-discovery convention. When a manifest field's validation keeps changing across Claude Code versions, prefer a layout that doesn't need the field at all.

45. **Doc drift compounds.** This is the 4th release in a row where README, CHANGELOG, ROADMAP, and HOW_WE_BUILT_THIS.md fell behind the canonical version files. A self-review run with the panel on its own repo (2026-04-19) surfaced three P0 contradictions (stale slash commands, mislabeled marketplace name, incomplete CHANGELOG) and four P1 issues (wrong test count, stale dir diagram, missing migration block, ROADMAP frozen at 2.16.4). The structural fix is a pre-release grep script (`scripts/release-check.sh` added in 2.16.6) that catches prior-version strings + stale install commands across non-canonical files — manual doc upkeep does not scale with release cadence.

---

## File Inventory

```
├── .claude-plugin/
│   └── marketplace.json                # Marketplace manifest (name: "agent-review-panel", 2 bundled plugins)
├── plugins/
│   ├── agent-review-panel/             # This plugin — the multi-agent review panel (install name: "agent-review-panel")
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json             # Plugin metadata (name: "agent-review-panel", v2.16.6)
│   │   ├── skills/                     # Nested skills layout (v2.16.5, PR #30) — required by Claude Code ≥2.1.112
│   │   │   └── agent-review-panel/
│   │   │       ├── SKILL.md            # The skill itself (~1380 lines — 16 phases + sub-phases)
│   │   │       └── references/         # Companion reference files (moved under skill in v2.16.5)
│   │   │           ├── signals-and-checklists.md
│   │   │           ├── prompt-templates.md
│   │   │           ├── changelog.md
│   │   │           └── research-v28.md
│   │   └── eval-suite.json             # Schliff eval suite (triggers + assertions)
│   └── plan-review-integrator/         # Bundled companion plugin (v2.0.1)
│       ├── .claude-plugin/
│       │   └── plugin.json             # Plugin metadata (v2.0.1)
│       ├── skills/
│       │   └── plan-review-integrator/
│       │       └── SKILL.md            # The integrator skill
│       └── eval-suite.json             # Per-plugin eval suite
├── tests/
│   ├── trigger-classification.test.mjs   # Multi-plugin — iterates every plugins/<name>/eval-suite.json
│   ├── manifest-consistency.test.mjs     # Multi-plugin — per-plugin cross-version assertions (PR #21+PR #22)
│   ├── eval-suite-integrity.test.mjs     # agent-review-panel-specific — v2.9/v2.14/v2.15 coverage blocks
│   ├── behavioral-assertions.test.mjs    # agent-review-panel-specific — fixture-based behavioral assertions
│   ├── report-structure.test.mjs         # agent-review-panel-specific — report format validation
│   ├── golden-file.test.mjs              # agent-review-panel-specific — golden fingerprint snapshots
│   ├── fixtures/                         # Sample reports (valid, minimal, low-confidence)
│   └── golden/                           # Golden JSON fingerprints
├── docs/
│   ├── research-foundations.md         # Full research foundations breakdown (9+ papers)
│   ├── hero-flow.svg                   # Pipeline architecture diagram
│   ├── demo.gif                        # Animated demo
│   ├── html-demo.gif                   # v2.15 expandable-card HTML report demo
│   └── archive/                        # Historical artifacts
│       ├── SKILL.v2.md, SKILL.v2.1.md  # Old skill versions
│       ├── review_panel_report.md      # v2.8 roadmap panel review
│       └── v25-vs-v26-comparison.md    # A/B test results
├── scripts/
│   └── release-check.sh                # Pre-release doc-drift check (v2.16.6+) — greps for stale versions + slash commands
├── .github/workflows/
│   └── test.yml                        # GitHub Actions — runs `npm test` on every push/PR
├── README.md                           # User-facing documentation (install via /plugin marketplace add)
├── HOW_WE_BUILT_THIS.md                # This file (Steps 1–21 chronicling v1–v2.16.6)
├── ROADMAP.md                          # Unified research + trust roadmap (22+ papers, 14 projects)
├── CHANGELOG.md                        # Top-level changelog (v1.0 → v2.16.6)
├── package.json                        # Node.js test runner config (v2.16.6, 354 tests)
└── LICENSE                             # MIT
```
