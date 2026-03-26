---
name: agent-review-panel
description: >
  Orchestrate a multi-agent adversarial review panel where several Claude Code
  subagents with different perspectives independently review a piece of work,
  debate with each other, reach (or fail to reach) consensus, then a supreme
  judge renders the final verdict. Use this skill whenever the user asks for a
  "review panel", "multi-agent review", "adversarial review", "have agents
  debate this", "review with multiple perspectives", "panel review", "get
  different opinions on this code/plan/doc", or invokes /agent-review-panel.
  Also trigger when a user says things like "I want thorough feedback from
  different angles", "stress-test this design", "red team this", "get a second
  (third, fourth) opinion", "fresh eyes on this", "multiple reviewers",
  "devil's advocate perspective", "every angle covered", "I want agents to
  argue pros and cons", "independently evaluate", "critical look from security
  and performance angles", "high-stakes — cover every angle", or "debate the
  pros and cons". This skill is specifically about launching multiple reviewer
  agents with distinct personas who discuss and debate — NOT for single-reviewer
  code review, quick sanity checks, bug fixes, deployment tasks, addressing
  existing PR comments, skill improvement, peer review, code explanation, or
  writing tests. Supports "deep research mode" when user says "deep review",
  "thorough review", "research review", or passes "deep" to
  /agent-review-panel — adds web research for domain best practices before
  launching reviewers.
---

# Agent Review Panel v2.7

A multi-agent adversarial review system based on nine research foundations:
ChatEval (ICLR 2024), AutoGen, Du et al. (ICML 2024), MachineSoM (ACL 2024),
DebateLLM, DMAD (ICLR 2025), "Talk Isn't Always Cheap" (ICML 2025),
CONSENSAGENT (ACL 2025), Trust or Escalate (ICLR 2025 Oral).

## When NOT to Use This Skill

Do NOT trigger for these requests — they need single-agent handling or other skills:
- Single code review ("review this function for bugs")
- Quick sanity checks ("just a quick look before I push")
- Bug fixes ("fix the type errors", "fix the failing test")
- Peer review without multi-perspective signal ("peer review this doc")
- Code explanation ("what does this code do?")
- Deployment tasks ("deploy to staging")
- Addressing existing feedback ("address the PR comments")
- Skill improvement ("make this skill better") → use schliff
- Writing tests, READMEs, or documentation
- Asking for a single opinion ("what do you think?", "is this any good?")

The key signal is **multiple independent perspectives** — if the user wants one opinion, don't launch a panel.

## Input

This skill takes as input one or more of: file paths to review, inline code/text
in the conversation, a git diff or PR reference, or a plan/design document.
It expects the user to specify (or let it auto-detect) what to review.

## Dependencies

This skill depends on the Agent tool to launch parallel subagent reviewers and
requires bash for context gathering (grep, file reads). All agents use
`model: "opus"`. Knowledge mining reads from memory paths if they exist; if
not available, it degrades gracefully — no hard dependency.

This skill is scoped to multi-perspective adversarial review. For skill
improvement requests, use schliff instead. For post-review plan updates,
use plan-review-integrator. Supported versions: Claude Code v1.0+.

## Examples

**Example 1: Code review panel**
Input: "Do a review panel on src/auth/middleware.ts — I want multiple perspectives before merging"
Output: Classifies as pure code → selects Correctness Hawk + Architecture Critic + Security Auditor + Devil's Advocate → gathers context → 4 parallel reviewers → 2 debate rounds → completeness audit → claim verification → supreme judge → writes `review_panel_report.md`

**Example 2: Mixed content with deep research**
Input: "Deep review of our migration plan — it includes SQL and Terraform"
Output: Classifies as mixed → adds Code Quality Auditor + Data Quality Auditor (SQL signal) + Reliability/SRE (infra signal) → runs web research for best practices → full panel → report with epistemic labels

## Process Overview

```
Phase 1: Setup              → Identify work, pick personas, define criteria
Phase 2: Independent Review → All reviewers evaluate in parallel (no cross-talk)
Phase 2.5: Private Reflection → Each reviewer re-reads source, rates own confidence
Phase 3: Debate             → Reviewers engage with each other + find new issues
Phase 3.5: Summarize        → Distill resolved/unresolved points between rounds
Phase 4: Blind Final        → Each reviewer gives final score independently
Phase 4.5: Completeness Audit → Dedicated agent scans for what the panel missed
Phase 4.6: Claim Verification → Verify all line-number citations against source
Phase 4.7: Severity Verification → Read actual code for every P0/P1, downgrade if overstated
Phase 5: Supreme Judge      → Opus arbitrates everything including verification results
Phase 6: Document           → Structured markdown report for human review
```

---

## Phase 1: Setup

### Identify the Work

The user provides: file paths, inline content, git diff/PR, or a plan/design doc.
Collect full content, then run Context Gathering (below).

**Classify content type** (matters for persona selection):
- **Pure code** — only code files
- **Pure plan/design** — architecture docs, proposals, RFCs
- **Mixed** — plans with code snippets, SQL, or config
- **Documentation** — READMEs, guides, API docs

### Detect Content Signals

Scan work for technology-specific signals (case-insensitive, 3+ keyword threshold).
See `references/signals-and-checklists.md` for the full detection table and domain
checklists. Signal detection only fires when auto-selecting personas.

### Context Gathering

**Run these steps before launching reviewers for file-path reviews. Skipping is
the #1 cause of incorrect [CRITICAL] recommendations.**

1. **Sibling Directory Scan** — From reviewed files' parent, scan for `docs/`,
   `README*`, `CLAUDE.md`, `config.py`, `package.json`, etc. Read first 50 lines
   of each. If files are nested, scan both immediate parent and project root.

2. **Reference Tracing** — Scan for imports, config references, cross-file
   references in comments, SQL table references, file path strings.

3. **Safety Mechanism Discovery** — Grep reviewed code + imports for: `_valid`,
   `_flag`, `_guard`, `_check`, `_mask`, `<= target_date`, `BETWEEN`, `fillna`,
   `COALESCE`, `try/except`, `DELETE FROM`, `MERGE`, `WRITE_TRUNCATE`,
   `upsert`, `idempoten`, `--dry-run`, `duplicate`, `assertion`. Note what each
   guards against. **Critical:** When a finding claims "X is missing", verify
   the claim by grepping the actual code — existing safety mechanisms are the
   #1 thing panels miss (v2.6 benchmark: panel claimed "non-idempotent writes"
   but DELETE-then-INSERT with duplicate validation already existed).

3b. **Temporal Scope Verification** — When the work contains ANY temporal
   claims (e.g., "excludes Christmas", "masks winter period", "filters out
   weekends", "pre-period starts after X"), verify that the exclusion applies
   to ALL instances across the full date range, not just the first/most-obvious
   one. Common failure: "excludes Christmas" via a Jan 6 start date only
   excludes the first Christmas — a second Christmas 12 months later may still
   be in the training window. This class of bug evaded 3 rounds of adversarial
   review (12 reviewers) in a real engagement — the user caught it 6 days later.
   **Inject into reviewer prompts:** "For any temporal exclusion claim, count
   how many instances of the excluded event exist in the date range and verify
   ALL are excluded, not just one."

4. **Knowledge Mining** — Mine local knowledge sources:
   - `feedback_*.md` (HIGHEST PRIORITY — past corrections with Why/How)
   - `project_*.md`, `MEMORY.md`, `lessons.md` (project + global)
   - Skills (`~/.claude/skills/*/SKILL.md`) — extract relevant caveats
   - `CLAUDE.md` — conventions and constraints

5. **Web Research** (deep research mode only) — Triggers when user requests
   "deep review" or 5+ keywords from a signal group with no built-in checklist.
   Cap at 2 web searches. Tag findings with [WEB].

6. **Context Brief** — Compile into structured brief with sections: System
   Documentation Found, Referenced Files, Safety Mechanisms, Knowledge Mining
   Results, Web Research Findings, Domain Checklist, Context Gaps.

7. **User Confirmation** — If significant context gaps exist or deep research
   is available but not requested, ask before proceeding.

### Select Personas with Agreement Intensity

If user specifies personas, use those. Otherwise select 4 from content-type sets:

**For code/implementation:**
1. **Correctness Hawk** (30%) — Bugs, logic errors, edge cases
2. **Architecture Critic** (50%) — Design patterns, coupling, extensibility
3. **Security Auditor** (30%) — Vulnerabilities, injection, auth gaps
4. **Devil's Advocate** (20%) — Challenges everything, proposes alternatives

**For plans/designs (pure — no code):**
1. **Feasibility Analyst** (60%) — Technical feasibility, timeline realism
2. **Stakeholder Advocate** (50%) — Business perspective, ROI
3. **Risk Assessor** (30%) — Failure modes, dependencies
4. **Devil's Advocate** (20%)

**For mixed content (plans WITH code/SQL/config) — CRITICAL:**
1. **Feasibility Analyst** (60%)
2. **Code Quality Auditor** (40%) — Line-by-line scrutiny of every snippet
3. **Risk Assessor** (30%)
4. **Devil's Advocate** (20%)

**For documentation:**
1. **Clarity Editor** (60%)
2. **Technical Accuracy Reviewer** (30%)
3. **Completeness Checker** (40%)
4. **Devil's Advocate** (20%)

After base selection, auto-add signal-detected personas (up to 6 total).
Replace Devil's Advocate first if at cap (keep ≥1 DA if panel ≥4).

**CRITICAL: If work contains ANY code/SQL/config snippets, always include
Code Quality Auditor — the #1 cause of missed details in v1.**

### Reasoning Strategy Assignment (DMAD, ICLR 2025)

| Persona Type | Strategy | Injection |
|---|---|---|
| Correctness Hawk / Code Quality Auditor | Systematic enumeration | "Enumerate every code path, constant, edge case." |
| Architecture Critic / Feasibility Analyst | Backward reasoning | "Start from desired outcome, trace backward." |
| Security Auditor / Risk Assessor | Adversarial simulation | "Imagine you are an attacker. How would you break this?" |
| Devil's Advocate | Analogical reasoning | "Compare to known failure patterns from similar projects." |
| Stakeholder Advocate / Clarity Editor | First-principles | "Question every assumption from scratch." |
| Auto-added specialists | Checklist verification | "Use your domain checklist. Verify each item." |

### Default Evaluation Criteria

Correctness, Completeness, Quality, Edge Cases (override if user specifies).

---

## Phase 2: Independent Review (Round 0)

Launch ALL reviewer agents **in parallel** using Agent tool with `model: "opus"`.
Each gets the structured prompt from `references/prompt-templates.md` (Phase 2
template) with their persona, agreement intensity, reasoning strategy, context
brief, and the full work content inside injection boundaries.

Collect all N independent reviews.

---

## Phase 2.5: Private Reflection

Launch all reviewers **in parallel**, each receiving ONLY their own review.
They re-read source, rate confidence per finding (High/Medium/Low), note new
issues, identify most/least defensible findings. See `references/prompt-templates.md`.

---

## Phase 3: Debate (Rounds 1-3, adaptive)

Launch all reviewers **in parallel** each round. Each receives their own review
+ reflection, all others' feedback, and unresolved points from previous round.

### Phase 3.5: Round Summarization

After each round, summarize (no agent needed):
- **Resolved this round** — who agreed, what convinced them
- **Still in dispute** — with inlined source excerpts (max 10 lines per dispute,
  max 3 disputes). Tag `[source not cited]` for vague claims.
- **New discoveries** — from which reviewer

### Sycophancy Detection (CONSENSAGENT)

Count position changes toward majority. If >50% lack new evidence → inject
sycophancy alert into next round prompt for all reviewers.

### Convergence Check

- All disputes minor/stylistic → stop
- Substantive disagreements remain → continue
- New discoveries still emerging → continue
- Maximum 3 rounds regardless

---

## Phase 4: Blind Final Assessment

Launch all reviewers one final time in parallel. Each gives final score, top 3
points, recommendation, one-line verdict. Others do NOT see these.

---

## Phase 4.5: Completeness Audit

Single agent (`model: "opus"`) hunts for what the entire panel missed. Does NOT
evaluate quality — only finds overlooked details, edge cases, constants, code.
See `references/prompt-templates.md` for full prompt.

**Mandatory audit checks (in addition to general completeness):**
- **Temporal scope verification:** For every claim that excludes, filters, or
  masks a time period, count all instances in the full date range and verify
  each is handled. Example: "excludes Christmas" with 2 years of data must
  exclude BOTH Christmases. This is the #1 class of bug that reviewers miss
  because they focus on the method, not the temporal arithmetic.

---

## Phase 4.6: Claim Verification

Single agent (`model: "opus"`) checks all reviewer citations against source.
Classifies each as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED],
or [UNVERIFIABLE]. Results feed into judge prompt.

---

## Phase 4.7: Severity Verification (v2.7)

Single agent (`model: "opus"`) that reads the actual codebase to verify every
P0 and P1 finding before the judge sees them. This phase exists because panels
systematically overstate severity when they lack runtime context (v2.6
benchmark: 2/3 P0 findings were overstated after code investigation).

**For each P0/P1 finding, the agent must:**

1. **Classify as `[EXISTING_DEFECT]` or `[PLAN_RISK]`**
   - `[EXISTING_DEFECT]`: The bug exists in the current running code right now
   - `[PLAN_RISK]`: The risk would only materialise if the plan is implemented as written
   - P0 severity requires `[EXISTING_DEFECT]`. A `[PLAN_RISK]` is at most P1.

2. **Verify the claim against actual code**
   - If the finding says "X is missing", grep for X in the actual codebase
   - If the finding says "X pattern is wrong", read the referenced code and check
   - If the finding cites a specific file/line, read that file and verify
   - If no reviewer cited a specific line number, flag as `[UNCITED]`

3. **Check for existing safety mechanisms**
   - Grep for DELETE, MERGE, upsert, idempotent, dry-run, duplicate, assertion
     patterns near the referenced code
   - A finding about "missing safety" is invalid if the safety exists but the
     reviewer didn't look for it

4. **Output a severity verification table:**

```
| Finding | Panel Severity | Verified? | Actual Severity | Reason |
|---------|---------------|-----------|-----------------|--------|
| ...     | P0            | No        | Not a bug       | Grep found no bf/af COALESCE pattern |
| ...     | P0            | Partial   | P1              | DELETE-then-INSERT already exists |
```

Results feed into the Supreme Judge prompt. The judge MUST reference the
verification table when ruling on disagreements.

---

## Phase 5: Supreme Judge

Single agent (`model: "opus"`). Receives everything. Steps:
0. Review claim verification AND severity verification — disregard overstated findings
1. Verify audit findings, anti-rhetoric assessment
2. Evaluate debate quality, rule on disagreements
3. Check consensus correctness, absent-safeguard check
4. Independent gap check, score assessment
5. Classify all findings with epistemic labels
6. Final verdict: recommendation, confidence, strengths, issues, action items
7. Meta-observation on what the process revealed

See `references/prompt-templates.md` for full judge prompt.

---

## Phase 6: Human Review Document

Write structured markdown report to `review_panel_report.md` (or user-specified name).

### Report Structure

```markdown
# Review Panel Report
**Work reviewed:** {title/path}  |  **Date:** {today}
**Panel:** {N} reviewers + Auditor + Judge
**Verdict:** {recommendation}  |  **Confidence:** {High|Medium|Low}
**Auto-detected signals:** {list or "None — base set used"}

## Executive Summary
{Judge's verdict, 3-5 sentences. Score X/10.}
{If score spread < 2: Correlation Notice about shared model biases}
{If Low confidence: "⚠️ HUMAN REVIEW RECOMMENDED"}

## Scope & Limitations
{What was reviewed. What CANNOT be evaluated: runtime behavior, production
data, security via dynamic analysis. Structural limitation: shared base model.}
Epistemic labels: [VERIFIED] [CONSENSUS] [SINGLE-SOURCE] [UNVERIFIED] [DISPUTED]
Defect type labels: [EXISTING_DEFECT] (bug in current code) [PLAN_RISK] (risk if plan is implemented as written)

## Score Summary
| Reviewer | Persona | Intensity | Initial | Final | Recommendation |

## Consensus Points
{Bullet list of points all/most reviewers agreed on, confirmed by judge}
## Disagreement Points (with judge rulings)
{Each disagreement: Side A, Side B, Judge's ruling with reasoning}
## Completeness Audit Findings
{New issues found by auditor, verified by judge}
## Action Items (with severity AND epistemic labels)

## Detailed Reviews (collapsible sections)
- Round 0: Independent Reviews
- Private Reflections
- Debate Rounds + Summaries
- Final Blind Assessments
- Completeness Audit
- Claim Verification Report
- Severity Verification Table
- Supreme Judge Full Analysis
```

After writing, tell user: report location, verdict + score, consensus vs
disagreements count, audit findings count, top action item.

---

## Implementation Notes

- **Parallel execution:** Phases 2, 2.5, 3, 4 use single message with multiple
  Agent tool calls. Phases 4.5, 4.6, 5 are sequential single agents.
- **Context management:** Full content in Phases 2, 4.5, 5. Phase 3.5 summaries
  with source excerpts in debate rounds for long works (>500 lines).
- **Error handling:** Retry failed agents once. Proceed with minimum 2 reviewers.
  Note gaps in report.
- **Idempotent:** Safe to re-run on the same content — each invocation produces
  an independent panel with no side effects from previous runs.
- **Auto-persona algorithm:** Classify → base set → signal scan → add up to 6 →
  replace DA first. See `references/signals-and-checklists.md` for signal table.

For full prompt templates, see `references/prompt-templates.md`.
For version history, see `references/changelog.md`.
