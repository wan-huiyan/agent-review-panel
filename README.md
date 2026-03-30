# Agent Review Panel

[![Tests](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml/badge.svg)](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml)

A Claude Code skill that orchestrates multi-agent adversarial review panels. Multiple AI reviewers with distinct personas independently evaluate your work, debate each other's findings, then a supreme judge renders the final verdict — all compiled into a structured report for human review.

[![Agent Review Panel — pipeline architecture](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/hero-flow.svg?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/hero-flow.svg?v=1)

[![Agent Review Panel — pixel art flow](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/pixel-flow.svg?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/pixel-flow.svg?v=1)
*Cute version: Claude Code orchestrates 6 persona-based reviewers through adversarial debate to a final verdict.*

[![Agent Review Panel — animated flow](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/pixel-flow.gif?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/pixel-flow.gif?v=1)

[![Agent Review Panel — sketch art flow](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/sketch-flow.gif?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/sketch-flow-animated.svg?v=1)
*Sketchy version: 8-scene animated story from prompt to verdict with expressive characters, adversarial debate, blind finals, and gavel slam.*

[![Agent Review Panel demo](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/demo.gif?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/demo.gif?v=1)

## Why This Exists

**The single-reviewer problem:** When you ask Claude to "review this code" or "check this plan," you get one perspective. It's thorough, but it's one mind looking at one thing. It won't argue with itself. It won't catch its own blind spots. And it will never tell you "I'm not sure about this" the way a real team would.

**What research shows:** Papers from ICLR 2024 (ChatEval), ICML 2024 (Du et al.), and ACL 2024 (MachineSoM) demonstrate that multi-agent debate consistently outperforms single-agent review on evaluation quality — agents cross-verify each other's claims, challenge weak reasoning, and surface issues no individual reviewer would find alone.

**What you get that a single reviewer can't provide:**

| Feature | What It Does |
|---|---|
| Structured disagreements with reasoning | Each disagreement shows both sides' arguments + the judge's ruling |
| Numerical scores + verdict | Every reviewer scores independently; judge delivers final recommendation |
| Cross-reviewer debate & engagement | Reviewers respond to each other's specific points across 1-3 rounds |
| Anti-groupthink blind assessment | Final scores given without seeing others' finals — prevents conformity |
| Post-debate completeness audit | Dedicated agent re-reads source line-by-line after debate to catch what everyone missed |
| Claim verification (Phase 9) | Verifies all reviewer line-number citations against actual source — catches hallucinated findings |
| Severity verification (Phase 10) | Reads actual code for every P0/P1 finding — catches overstated severity |
| Verification commands (Phase 8) | Runs grep/read commands from reviewers to confirm or contradict P0/P1 claims |
| Epistemic labels on findings | Every finding tagged [VERIFIED], [CONSENSUS], [SINGLE-SOURCE], [UNVERIFIED], or [DISPUTED] |
| Defect classification | Findings labeled [EXISTING_DEFECT] or [PLAN_RISK] — P0 requires existing defect evidence |
| Scope & limitations disclosure | Every report states what the panel cannot evaluate — prevents over-trust |
| Correlated-bias warning | When all reviewers agree (spread < 2pts), flags that unanimity may reflect shared model bias |
| Code-level detail catching | Line-by-line audit of constants, sets, SQL, config values in every review |
| Auto-persona from content signals | 10 signal groups with keyword detection add domain specialists up to 6 reviewers |
| Auto Precise/Exhaustive mode | Code → require line citations; plans → allow broader risk identification. Auto-detected. |
| Source-grounded debate | Disputed points include inline source code snippets — keeps debate anchored to reality |
| Context gathering (Phase 1-2) | Auto-scans sibling directories for docs, traces imports/references, discovers safety mechanisms, asks user about gaps |
| Tiered knowledge mining (Phase 1-2) | L0/L1/L2 loading: scans index lines first, then summaries, then full content only for relevant items — reduces token waste by ~80% vs flat reads |
| Built-in domain checklists | 10 signal groups get pre-built review checklists (ML, SQL, Pipeline, Cost, etc.) — zero-latency domain expertise |
| VoltAgent specialist agents | Optional upgrade: 127+ specialist agents across 10 families replace generic persona-prompted reviewers for deeper domain reviews |
| Absent-safeguard check (judge) | Judge verifies [CRITICAL] recommendations account for existing safety mechanisms before endorsing |
| Reviewer suggestion qualifier | Reviewers must state what safeguard would need to be absent; flag unverified assumptions |
| Diverse reasoning strategies | Each reviewer uses a different reasoning approach (systematic enumeration, adversarial simulation, backward reasoning, etc.) |
| Anti-rhetoric guard | Judge flags position changes driven by eloquence rather than evidence |
| Dynamic sycophancy intervention | Detects and intervenes when >50% of position changes lack new evidence |
| Judge confidence gating | Low-confidence verdicts get "HUMAN REVIEW RECOMMENDED" flag instead of forcing a call |
| Deep research mode | Opt-in web research for domain best practices; triggered by "deep review" or offered when strong signals detected |

The skill doesn't just find *more* issues — it **structures** them. You get consensus points, disagreement points with both sides' reasoning, a judge's ruling, and prioritized action items. A single reviewer gives you a list; the panel gives you a deliberation.

## How It Works

| Stage          | Phase | Action                                                          |
|----------------|-------|-----------------------------------------------------------------|
| **Gather**     | 1.    | Context & Setup — scan sibling dirs, trace references, discover safeguards |
|                | 2.    | Detect Specialists — signal detection, persona selection, knowledge mining |
| **Review**     | 3.    | Independent Review — 4-6 reviewers evaluate in parallel (no cross-talk) |
|                | 4.    | Private Reflection — each reviewer re-reads and rates own confidence |
| **Debate**     | 5.    | Adversarial Debate (1-3 rounds) — reviewers engage + find new issues |
|                | 6.    | Summarize — distill resolved/unresolved points between rounds |
|                | 7.    | Blind Final — each reviewer gives final score independently |
| **Verify**     | 8.    | Verify Commands — run reviewer grep/read commands for P0/P1 findings (advisory) |
|                | 9.    | Claim Verification — verify all line-number citations against source |
|                | 10.   | Severity Verification — read actual code for every P0/P1; downgrade if overstated |
|                | 11.   | Completeness Audit — dedicated agent scans for what the panel missed |
| **Adjudicate** | 12.   | Supreme Judge — Opus arbitrates everything including verification results |
|                | 13.   | Document — structured markdown report for human review |

## What Makes This Different from "Just Asking Claude to Review"

### 1. Real Debate, Not Simulated Perspectives

When you ask a single agent to "review from multiple perspectives," it produces parallel sections — but they never disagree. There's no cross-verification, no "wait, that's wrong because..." moments.

The review panel spawns independent subagents that genuinely engage:

> **Feasibility Analyst:** "The `data_available_through` hardcoding is minor — it's documented."
>
> **Risk Assessor:** "Disagree. If stale, the lookforward extends past actual data → model trains on rows with incomplete outcomes → silent false-negative bias."
>
> **Feasibility Analyst (Round 2):** "Valid point. I upgrade this to IMPORTANT."

This isn't possible with a single agent.

### 2. Multi-Layered Verification

The panel doesn't just find issues — it verifies them through multiple independent mechanisms:

- **Completeness Auditor** (Phase 11) — a post-debate agent re-reads the source line-by-line to find what every reviewer missed
- **Claim Verification** (Phase 9) — checks every line-number citation against actual source; classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE]
- **Severity Verification** (Phase 10) — reads actual code for every P0/P1 finding; v2.6 benchmark showed 2/3 P0 findings were overstated
- **Verification Commands** (Phase 8) — runs reviewer-provided grep/read commands to confirm or contradict claims
- **Absent-safeguard check** — judge verifies that [CRITICAL] recommendations account for existing safety mechanisms

### 3. Anti-Groupthink Mechanisms

Research shows multi-agent systems are prone to conformity — agents abandon correct findings under social pressure. We counter this with:

- **Private reflection** before debate (MachineSoM) — agents commit to confidence levels before seeing others' views
- **Blind final assessment** (ChatEval) — final scores given without seeing others' finals
- **Calibrated agreement intensity** (DebateLLM) — each persona has a tuned skepticism level (20-60%), preventing both reflexive agreement and manufactured disagreement
- **Conformity tracking** — the judge flags any agent that flipped position without new evidence
- **Dynamic sycophancy intervention** (CONSENSAGENT) — when >50% of position changes lack new evidence, an alert is injected requiring agents to identify a weakness in the consensus
- **Judge confidence gating** (Trust or Escalate) — low-confidence verdicts flag "HUMAN REVIEW RECOMMENDED" rather than forcing a definitive call

### 4. Structured Output for Humans

The output isn't a wall of text. It's a scannable report:

```markdown
## Executive Summary              ← Read this in 30 seconds
## Scope & Limitations            ← What the panel can't evaluate
## Score Summary Table            ← Initial → Final scores per reviewer
## Consensus Points               ← What everyone agreed on
## Disagreement Points            ← Each side's argument + judge's ruling
## Completeness Audit Findings    ← What the whole panel missed
## Coverage Gaps                  ← Risk categories no reviewer examined
## Action Items                   ← [P0] [VERIFIED] / [P1] [CONSENSUS] / etc.
## Detailed Reviews               ← Collapsible: all rounds, verification tables, judge analysis
```

## Usage

```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /agent-review-panel

> Get a panel review of the authentication module — I want to stress-test the design

> Red team this deployment strategy

> Have agents debate whether this refactor is worth the complexity

> /agent-review-panel deep              ← deep research mode (adds web research)

> Do a deep review of this ML pipeline   ← also triggers deep research mode
```

The skill auto-detects content type (pure code, pure plan, mixed, documentation) and selects appropriate personas and review mode (Precise for code, Exhaustive for plans). It scans for technology signals across 10 signal groups (SQL, ML/Statistics, Infrastructure, Auth, API, Frontend, Cost/Billing, Data Pipeline, Skill/Docs Portability, Repo/Data Hygiene) and automatically adds domain-specific reviewers when 3+ keywords from a signal group are detected. You can also specify custom reviewers.

## Research Foundations

| Source | Contribution |
|--------|-------------|
| [ChatEval](https://github.com/thunlp/ChatEval) (ICLR 2024) | Blind final judgment, anti-groupthink |
| [AutoGen](https://github.com/microsoft/autogen) Multi-Agent Debate | Solver/aggregator architecture |
| [Du et al.](https://arxiv.org/abs/2305.14325) (ICML 2024) | Cross-verification for factuality |
| [MachineSoM](https://github.com/zjunlp/MachineSoM) (ACL 2024) | Private reflection, conformity tracking |
| [DebateLLM](https://github.com/instadeepai/DebateLLM) | Agreement intensity modulation |
| [DMAD](https://github.com/MraDonkey/DMAD) (ICLR 2025) | Diverse reasoning strategies per persona |
| [Talk Isn't Always Cheap](https://arxiv.org/abs/2509.05396) (ICML 2025) | Anti-rhetoric guard in judge prompt |
| [CONSENSAGENT](https://aclanthology.org/2025.findings-acl.1141/) (ACL 2025) | Dynamic sycophancy intervention |
| [Trust or Escalate](https://arxiv.org/abs/2407.18370) (ICLR 2025) | Judge confidence gating |
| [AI Trust Evaluation Framework](https://github.com/wan-huiyan/ai-trust-evaluation) | Claim verification, epistemic labels, scope disclosure, correlated-bias detection |
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 127+ specialist agents across 10 families; persona-to-agent mapping for domain-specific reviews |

See `ROADMAP.md` for the full research roadmap (includes trust & verification items, merged from former TRUST_ROADMAP.md).

## Cost & Performance

- **Duration:** ~6-8 minutes per review (vs ~3 minutes for single-agent). 6-reviewer panels (with auto-persona) run ~8 minutes.
- **Tokens:** Comparable to single-agent (~75k vs ~80k) — focused personas are more token-efficient. Auto-added reviewers add ~25-30% when triggered.
- **When to use:** High-stakes reviews where you need structured disagreement tracking, not quick feedback
- **When NOT to use:** Simple code reviews, style checks, or when you just need a quick sanity check

## Installation

### Claude Code

**Option 1: Plugin install (recommended)**
```bash
/plugin marketplace add wan-huiyan/agent-review-panel
/plugin install agent-review-panel@wan-huiyan-agent-review-panel
```

**Option 2: Git clone**
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.claude/skills/agent-review-panel
```

### Cursor

Cursor supports skills via `~/.cursor/skills/` (Cursor 2.4+), though global discovery can be flaky. Options from most to least reliable:

**Option 1: Per-project rule (most reliable)**
```bash
mkdir -p .cursor/rules
# Create .cursor/rules/agent-review-panel.mdc with the content of SKILL.md
# Add frontmatter: alwaysApply: true
```

**Option 2: npx skills CLI**
```bash
npx skills add wan-huiyan/agent-review-panel --global
```

**Option 3: Manual global install**
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.cursor/skills/agent-review-panel
```

> **Cursor adaptation note:** This skill was written for Claude Code's **Agent tool** (6+ subagent calls with parallel spawn, model selection, etc.). Cursor has its own subagent/task mechanism (e.g. `mcp_task`), but the full panel flow isn't guaranteed without adaptation — differences in parallel spawning, prompt shape, and model selection (e.g. `model: "opus"`) may affect behavior.
>
> **Adapting for Cursor:** The core pattern is straightforward — one subagent/task per reviewer in the Review stage (Phases 3-4), collect results, then one per reviewer in the Debate stage (Phases 5-7), then single agents for the Verify and Adjudicate stages. If you adapt it, PRs are welcome!

## Tests

The project includes a comprehensive test suite (363 tests) using Node.js built-in test runner (zero dependencies):

```bash
npm test                    # run all 363 tests
npm run test:triggers       # trigger classification (49 prompts)
npm run test:manifest       # manifest consistency across files
npm run test:eval-suite     # eval-suite structural integrity
npm run test:report         # report structure validation
npm run test:behavioral     # behavioral assertion framework
npm run test:golden         # golden-file structural snapshots
```

The eval suite (`eval-suite.json`) contains 49 trigger classification examples, 10 behavioral test cases with regex assertions, and 11 edge-case scenarios — useful for understanding exactly when the skill should and shouldn't trigger.

## Companion Skills

| Skill | What It Does | When to Use |
|-------|-------------|-------------|
| [plan-review-integrator](https://github.com/wan-huiyan/plan-review-integrator) | Takes review panel output and integrates findings into an implementation plan — classifies each finding, applies concrete edits, produces a traceability summary | After a panel review of a plan document, run `/plan-review-integrator` to turn findings into plan updates |

---

The skill triggers automatically when you ask for multi-perspective reviews, panel reviews, adversarial reviews, or invoke `/agent-review-panel`.

## Version History

See `ROADMAP.md` for detailed version history, research sources, and deferred items.

| Version | Date | Highlights |
|---------|------|------------|
| v1 | 2026-03-14 | ChatEval + AutoGen + Du et al. foundations |
| v2 | 2026-03-15 | MachineSoM + DebateLLM: private reflection, agreement intensity |
| v2.1 | 2026-03-17 | Auto-persona from content signals, source-grounded debate |
| v2.2 | 2026-03-18 | DMAD reasoning strategies, anti-rhetoric guard, sycophancy intervention, confidence gating |
| v2.3 | 2026-03-18 | Knowledge mining, domain checklists, deep research mode |
| v2.4 | 2026-03-19 | Portability signal group (9 total) |
| v2.5 | 2026-03-20 | Trust layer: claim verification, epistemic labels, scope disclosure |
| v2.6 | 2026-03-25 | Schliff optimization (75 → 86), reference extraction, A/B validated |
| v2.7 | 2026-03-26 | Severity verification, temporal scope checks, defect classification |
| v2.8 | 2026-03-26 | Severity dampening, coverage check, verify-before-claim, auto Precise/Exhaustive mode, tiered knowledge mining, Repo/Data Hygiene signal (10 total) |
| v2.9 | 2026-03-29 | VoltAgent specialist agent integration (127+ agents, 10 families) |

## Acknowledgements

Trigger accuracy and eval suite improved using [schliff](https://github.com/Zandereins/schliff) — an autonomous skill scoring and improvement framework. Schliff's 7-dimension structural scorer identified weak trigger coverage and guided targeted description enrichment (composite score: 64 → 75).
