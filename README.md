[![GitHub release](https://img.shields.io/github/v/release/wan-huiyan/agent-review-panel)](https://github.com/wan-huiyan/agent-review-panel/releases) [![Claude Code](https://img.shields.io/badge/Claude_Code-skill-orange)](https://claude.com/claude-code) [![license](https://img.shields.io/github/license/wan-huiyan/agent-review-panel)](LICENSE) [![last commit](https://img.shields.io/github/last-commit/wan-huiyan/agent-review-panel)](https://github.com/wan-huiyan/agent-review-panel/commits)
[![Tests](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml/badge.svg)](https://github.com/wan-huiyan/agent-review-panel/actions/workflows/test.yml)
[![Research Papers](https://img.shields.io/badge/research%20foundations-9%20papers-orange)](#research-foundations)

# Agent Review Panel

**Multiple AI reviewers independently evaluate your code, plans, or docs — then debate each other's findings. A judge renders the final verdict. You get a structured report with consensus, disagreements, and prioritized action items.**

A [Claude Code](https://claude.ai/code) skill that orchestrates multi-agent adversarial review panels backed by [9 research papers](#research-foundations) on multi-agent debate.

[![Agent Review Panel — pipeline architecture](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/hero-flow.svg?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/hero-flow.svg?v=1)

[![Agent Review Panel demo](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/demo.gif?v=1)](https://raw.githubusercontent.com/wan-huiyan/agent-review-panel/main/docs/demo.gif?v=1)

## Quick Start

**Install:**
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.claude/skills/agent-review-panel
```

**Use:**
```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /agent-review-panel
```

**What you get:** A `review_panel_report.md` with executive summary, consensus points, disagreement points (with judge rulings), completeness audit findings, and prioritized action items — all tagged with epistemic labels ([VERIFIED], [CONSENSUS], [DISPUTED], etc.).

<details>
<summary><strong>Example report output (truncated)</strong></summary>

```markdown
# Review Panel Report
**Work reviewed:** src/auth/middleware.ts  |  **Date:** 2026-03-28
**Panel:** 4 reviewers + Auditor + Judge
**Verdict:** Approve with Revisions  |  **Confidence:** High
**Review mode:** Precise (auto-detected from content type: code)

## Executive Summary
The authentication middleware is well-structured with proper token validation
and rate limiting. Two substantive issues emerged: the session store lacks
TTL enforcement (P1, [VERIFIED]) and the CORS configuration is overly
permissive for production (P1, [CONSENSUS]). Score: 7/10.

## Consensus Points
- Token rotation logic is correct and handles edge cases well
- Error responses follow RFC 7807 format consistently

## Disagreement Points
**Session store TTL:** Security Auditor (P0) vs Architecture Critic (P2)
Judge ruling: P1 — the risk is real but mitigated by the upstream API gateway
timeout. [VERIFIED] against actual code.

## Action Items
- [P1] [VERIFIED] Add TTL to session store entries (src/auth/session.ts:47)
- [P1] [CONSENSUS] Restrict CORS origins in production config
- [P2] [SINGLE-SOURCE] Consider adding request signing for internal APIs
```

</details>

## Installation

### Claude Code (v1.0+)

```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.claude/skills/agent-review-panel
```

The skill triggers automatically when you ask for multi-perspective reviews, panel reviews, adversarial reviews, or invoke `/agent-review-panel`.

### Cursor (experimental)

<details>
<summary>Cursor installation options</summary>

This skill was built for Claude Code's Agent tool (parallel subagent spawning, model selection). Cursor has its own mechanisms that may require adaptation.

**Per-project rule (most reliable):**
```bash
mkdir -p .cursor/rules
# Create .cursor/rules/agent-review-panel.mdc with the content of SKILL.md
# Add frontmatter: alwaysApply: true
```

**Manual global install:**
```bash
git clone https://github.com/wan-huiyan/agent-review-panel.git ~/.cursor/skills/agent-review-panel
```

The core pattern is straightforward — one subagent/task per reviewer in Phase 3, collect results, then one per reviewer in Phase 5 (debate), then single agents for verification and judge. If you adapt it, PRs are welcome.

</details>

## Why Use a Panel Instead of a Single Reviewer?

When you ask Claude to "review this code," you get one perspective. It won't argue with itself, catch its own blind spots, or tell you "I'm not sure about this."

The panel spawns independent reviewers that genuinely engage:

> **Feasibility Analyst:** "The `data_available_through` hardcoding is minor — it's documented."
>
> **Risk Assessor:** "Disagree. If stale, the lookforward extends past actual data — model trains on incomplete outcomes — silent false-negative bias."
>
> **Feasibility Analyst (Round 2):** "Valid point. I upgrade this to IMPORTANT."

A single reviewer gives you a list. The panel gives you a deliberation — with structured disagreements, judge rulings, and confidence levels.

## How It Works

| Stage | Phase | Action |
|---|---|---|
| **Gather** | 1. | Context & Setup — scan sibling dirs, trace references, discover safeguards |
| | 2. | Detect Specialists — signal detection, persona selection, knowledge mining |
| **Review** | 3. | Independent Review — 4-6 reviewers evaluate in parallel (no cross-talk) |
| | 4. | Private Reflection — each reviewer re-reads and rates own confidence |
| **Debate** | 5. | Adversarial Debate (1-3 rounds) — reviewers engage + find new issues |
| | 6. | Summarize — distill resolved/unresolved points between rounds |
| | 7. | Blind Final — each reviewer gives final score independently |
| **Verify** | 8. | Verify Commands — run reviewer grep/read commands for P0/P1 findings (advisory) |
| | 9. | Claim Verification — verify all line-number citations against source |
| | 10. | Severity Verification — read actual code for every P0/P1; downgrade if overstated |
| | 11. | Completeness Audit — dedicated agent scans for what the panel missed |
| **Adjudicate** | 12. | Supreme Judge — Opus arbitrates everything including verification results |
| | 13. | Document — structured markdown report for human review |

## Features

**Review process:**
- 4-6 reviewers with distinct personas evaluate in parallel, then debate across 1-3 rounds
- Auto-selects personas based on content type (code, plan, docs, mixed) and technology signals across 10 signal groups (SQL, ML, Terraform, Auth, API, Frontend, Cost, Pipeline, Portability, Repo Hygiene)
- Each reviewer uses a different reasoning strategy (systematic enumeration, adversarial simulation, backward reasoning, etc.)
- Auto Precise/Exhaustive mode: code requires line citations; plans allow broader risk identification

**Verification layer:**
- Claim verification checks all reviewer citations against actual source code
- Severity verification reads the codebase to confirm P0/P1 findings before the judge sees them (v2.6 benchmark: 2/3 P0 findings were overstated)
- Verification commands: runs read-only grep/cat commands from reviewers to confirm or contradict claims
- Defect classification: findings labeled [EXISTING_DEFECT] or [PLAN_RISK] — P0 requires existing defect evidence
- Completeness audit: post-debate agent re-reads source line-by-line for what everyone missed

**Anti-groupthink safeguards:**
- Blind final scoring, private reflection, calibrated skepticism levels (20-60%)
- Sycophancy detection intervenes when >50% of position changes lack new evidence
- Anti-rhetoric assessment flags position changes driven by eloquence rather than evidence
- Judge confidence gating: low-confidence verdicts flag "HUMAN REVIEW RECOMMENDED"
- Correlated-bias warning when all reviewers converge (unanimous agreement is the most dangerous failure mode)

**Output:**
- Structured markdown report: executive summary, consensus, disagreements (with judge rulings), prioritized action items
- Epistemic labels on every finding: [VERIFIED], [CONSENSUS], [SINGLE-SOURCE], [UNVERIFIED], [DISPUTED]
- Scope & limitations disclosure — every report states what the panel cannot evaluate

**Advanced:**
- VoltAgent integration — maps personas to 127+ specialist agents for deeper domain-specific reviews when installed
- Codebase state check — detects worktree/branch divergence to prevent false "missing code" findings
- Tiered knowledge mining (L0/L1/L2) — scans index lines first, then summaries, then full content only for relevant items
- Deep research mode — opt-in web research for domain best practices

## Usage Examples

```
> Review this implementation plan from multiple perspectives: docs/my_plan.md

> /agent-review-panel

> Get a panel review of the authentication module — I want to stress-test the design

> Red team this deployment strategy

> Have agents debate whether this refactor is worth the complexity

> /agent-review-panel deep              # adds web research for domain best practices

> Do a deep review of this ML pipeline   # also triggers deep research mode
```

The skill auto-detects content type and selects appropriate personas and review mode. You can also specify custom reviewers.

## Cost & Performance

| Metric | Value |
|---|---|
| Duration | ~6-10 minutes (4-reviewer panel); ~10-12 minutes (6-reviewer with auto-persona) |
| Token usage | Varies by content length and panel size. Typical range: 150k-350k total tokens across all subagent calls (input + output). Higher than single-agent review due to parallel reviewers + debate rounds. |
| Best for | High-stakes reviews where you need structured disagreement tracking |
| Not for | Quick code reviews, style checks, or single-opinion feedback |

## Known Limitations

- **Same base model:** All reviewers are Claude instances. Unanimous agreement may reflect shared model biases rather than genuine quality. The correlated-bias warning flags this, but cannot eliminate it.
- **No runtime analysis:** The panel reviews static code and documents. It cannot evaluate runtime behavior, production data patterns, or performance under load.
- **Token cost:** Multi-agent review costs more than single-agent. Use for high-stakes reviews, not routine checks.
- **Temporal reasoning:** Despite explicit checks, temporal scope verification (e.g., "excludes Christmas" with multi-year data) remains the hardest class of bug for panels to catch reliably.

## Research Foundations

Agent Review Panel is grounded in [9 peer-reviewed papers](docs/research-foundations.md) on multi-agent debate and evaluation quality (ChatEval/ICLR 2024, Du et al./ICML 2024, MachineSoM/ACL 2024, and more).

## Prerequisites

- **Claude Code** v1.0+ (the skill uses the Agent tool for parallel subagent spawning)
- Works with Claude Pro, Max, or API access
- **Optional:** [VoltAgent specialist agents](https://github.com/VoltAgent/awesome-claude-code-subagents) for stronger domain-specific reviews

## Tests

The project includes a comprehensive test suite (363 tests) using Node.js built-in test runner (zero dependencies):

```bash
npm test                    # run all 363 tests
npm run test:triggers       # trigger classification (49 prompts)
npm run test:manifest       # manifest consistency across files
npm run test:report         # report structure validation
npm run test:behavioral     # behavioral assertion framework
npm run test:golden         # golden-file structural snapshots
```

## Companion Skills

| Skill | What It Does | When to Use |
|---|---|---|
| [plan-review-integrator](https://github.com/wan-huiyan/plan-review-integrator) | Takes review panel output and integrates findings into an implementation plan — classifies each finding, applies concrete edits, produces a traceability summary | After a panel review of a plan document |

## Contributing

Contributions welcome! Areas where help is especially useful:

- **Cursor adaptation** — adapting the Agent tool calls to Cursor's subagent mechanism
- **New domain checklists** — adding signal groups beyond the current 10
- **Benchmark cases** — real-world review scenarios for the eval suite

Please open an issue to discuss before submitting large PRs.

## Uninstalling

```bash
rm -rf ~/.claude/skills/agent-review-panel
```

## Version History

See [CHANGELOG.md](CHANGELOG.md) for detailed version history. See [ROADMAP.md](ROADMAP.md) for research sources and deferred items.

| Version | Highlights |
|---------|------------|
| v2.10 | Codebase state check — prevents false "missing code" findings in worktrees |
| v2.9 | VoltAgent specialist agent integration (127+ agents, 10 families) |
| v2.8 | Auto Precise/Exhaustive mode, verification commands, tiered knowledge mining |
| v2.7 | Severity verification, defect classification, temporal scope checks |
| v2.6 | Schliff optimization (75 → 86), reference extraction, A/B validated |
| v2.5 | Trust layer: claim verification, epistemic labels, scope disclosure |
| v2.4 | Portability signal group |
| v2.3 | Knowledge mining, domain checklists, deep research mode |
| v2.2 | DMAD reasoning strategies, context gathering, anti-rhetoric guard |
| v2.1 | Auto-persona from content signals, source-grounded debate |
| v2.0 | Completeness auditor, new discovery requirement |
| v1.0 | Initial release: multi-agent review with debate and judge |

## License

[MIT](LICENSE) — Huiyan Wan

## Acknowledgements

- Eval suite improved using [schliff](https://github.com/Zandereins/schliff)
- See [HOW_WE_BUILT_THIS.md](HOW_WE_BUILT_THIS.md) for the design journey
