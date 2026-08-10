---
name: agent-review-panel
description: >
  Orchestrate a multi-agent adversarial review panel: subagents with different perspectives
  independently review, debate and discuss, reach or fail consensus, then a supreme judge renders the
  verdict. Trigger on "review panel", "multi-agent review", "adversarial review", "panel review",
  "have agents debate this", "get different opinions on this code/plan/doc", "multiple reviewers",
  "independently evaluate", "thorough feedback from different angles", "stress-test this design", "red
  team this", "devil's advocate perspective", "fresh eyes on this", "a second/third opinion", "argue
  pros and cons", "every angle covered", "critical look from security and performance angles",
  "high-stakes", or /agent-review-panel. NOT for single-reviewer review, quick sanity checks, bug
  fixes, deployment, existing PR comments, skill improvement, peer review, code explanation, or
  writing tests. Modes, also /agent-review-panel arguments: deep research ("deep review", "thorough
  review", "research review") researches domain best practices; multi-run union ("multi-run review",
  "run twice", "run 3 times", "maximum coverage") repeats with rotated personas, merged by stability;
  data-flow trace tiers ("exhaustive review", "trace everything", "catch all bugs") add a pre-review
  data-path trace; budget ("budget mode", "budget review", "cheap review", "low-cost panel",
  "token-efficient review", "keep the cost down", "without burning tokens") is the same protocol at
  reduced cost. Uses specialist domain-expert reviewers.
---

# Agent Review Panel v3.9.1

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
requires bash for context gathering (grep, file reads). Every agent launch
MUST pass a `model:` parameter **explicitly** — never rely on defaults. In the
full panel that model is `model: "opus"` for every agent. In **budget mode**
(v3.7.0, see Budget Mode section) reviewers and the consolidated verifier use
`model: "sonnet"` while the Supreme Judge stays on `model: "opus"` — the
explicit-model rule is unchanged; only the chosen tier differs. This includes
VoltAgent specialist agents launched via `subagent_type` — always pass the
model explicitly alongside `subagent_type` to override the agent's default.
Omitting it causes the launched agent to fall through to its own
frontmatter-declared model (which may be sonnet or haiku), introducing
cross-run reasoning variance.
Knowledge mining reads from memory paths if they exist; if not available,
it degrades gracefully — no hard dependency.

**HTML report CDN dependencies (Phase 15.3 output file only):** The generated
`review_panel_report.html` loads Tailwind CSS, Chart.js, and — new in v2.15 —
Prism.js from CDN for syntax highlighting in the Code Evidence sections of
expandable issue cards. If the CDNs are unreachable, the HTML degrades
gracefully: layout and text remain readable, charts show a placeholder, code
blocks render as unstyled monospace.

**Optional enhancement:** When VoltAgent specialist agents are installed, the
panel can use them instead of generic persona-prompted agents for stronger
domain-specific reviews. See "VoltAgent Integration" section below.

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
Phase 1:    Setup                     → Identify work, pick personas, define criteria
Phase 2:    Data Flow Trace           → Trace critical path(s), document schemas [code only] (v2.14)
Phase 3:    Independent Review        → All reviewers evaluate in parallel (no cross-talk)
Phase 4:    Private Reflection        → Each reviewer re-reads source, rates own confidence
Phase 5:    Debate (rounds 1–3)       → Reviewers engage with each other + find new issues
Phase 6:    Round Summarization       → Distill resolved/unresolved points between rounds
Phase 7:    Blind Final               → Each reviewer gives final score independently
Phase 8:    Completeness Audit        → Dedicated agent scans for what the panel missed
Phase 9:    Verify Commands           → Run up to 5 reviewer verification commands (advisory)
Phase 10:   Claim Verification        → Verify all line-number citations against source
Phase 11:   Severity Verification     → Read actual code for every P0/P1, downgrade if overstated + web-verify external domain claims (v2.16.3)
Phase 12:   Verification Tier Assign  → Confidence draft (12a) + judge-advised refinement (12b)
Phase 13:   Targeted Verification     → Persona-matched agents dispatched per dispute point
Phase 14:   Supreme Judge             → Opus arbitrates everything including verification round
Phase 14.5: Post-Judge Verification   → Re-verify judge-introduced P0/P1 against ground truth (v3.2.0)
Phase 15:   Output Generation         → (parent) Three output files (all sequential: 15.1 → 15.2 → 15.3)
  Phase 15.1: Primary Markdown Report → Structured markdown summary (review_panel_report.md)
  Phase 15.2: Process History         → Full director's-cut log (review_panel_process.md)
  Phase 15.3: HTML Report             → Interactive dashboard (review_panel_report.html)

[Multi-Run mode (--runs N > 1): repeat Phases 2–15 with rotated personas, then:]
Phase 16:   Merge                     → Deduplicate, score stability, produce merged report (v2.14)

[Budget mode ("budget review", v3.7.0): same protocol shape at a reduced-cost
profile — 3 sonnet reviewers, Phases 3+4 merged, exactly 1 debate round,
Phases 8+10+11 as ONE consolidated verification agent, no 12b/13, opus judge,
14.5 as an orchestrator grep-check, Phase 15.1 markdown output only.
See the Budget Mode section.]
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

### Review Mode Detection (v2.8)

Auto-detect review mode from content type. No user toggle.

| Content Type | Review Mode | Behavior |
|---|---|---|
| Pure code | **Precise** | Every finding MUST cite a specific file, line number, or code snippet. Findings without concrete evidence are demoted to [UNVERIFIED]. |
| Pure plan/design | **Exhaustive** | Broader risk identification allowed. Findings may reference design sections or architectural patterns without line-number evidence. |
| Mixed | **Precise** for code, **Exhaustive** for prose | Reviewers label each finding with its mode. Code findings without line citations are demoted. |
| Documentation | **Exhaustive** | Same as plan/design. |
| Subjective-quality deliverable (strategy report, marketing/creative copy, pitch deck, research synthesis) | **Assessment** | Goal is quality *discrimination*, not defect-finding. Score each axis 0–10 by **subtract-points + veto**, run the **swap test**, fact-check currency **out-of-band**, and **control-validate the personas** against a known-bad floor. See *Assessment Mode* below. |

The detected mode is injected into Phase 3 reviewer prompts and the judge prompt.
Report header states the detected mode.

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

3c. **Codebase State Check (v2.10)** — When reviewing code that lives in a git
   repository, determine the exact codebase state being reviewed. This prevents
   the panel from flagging code as "missing" when it exists on main but not in
   the reviewed branch/worktree.

   **Why this matters:** In a real engagement, a 4-reviewer panel + completeness
   auditor unanimously flagged a class as "non-existent" — but it existed on
   `main` (merged via a PR after the worktree branched). All reviewers checked
   the worktree files, none checked `main`. The finding was confidently wrong.

   **Steps:**
   ```bash
   # 1. Detect if we're in a worktree
   git rev-parse --is-inside-work-tree 2>/dev/null && \
   WORKTREE=$(git rev-parse --show-toplevel) && \
   BRANCH=$(git rev-parse --abbrev-ref HEAD)

   # 2. Find the default branch (main or master)
   DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@') || DEFAULT_BRANCH="main"

   # 3. Find the branch point and count divergence
   MERGE_BASE=$(git merge-base HEAD origin/$DEFAULT_BRANCH 2>/dev/null)
   COMMITS_BEHIND=$(git rev-list --count HEAD..origin/$DEFAULT_BRANCH 2>/dev/null || echo "unknown")

   # 4. List PRs/commits merged to main since branch point
   git log --oneline $MERGE_BASE..origin/$DEFAULT_BRANCH 2>/dev/null | head -20
   ```

   **If commits_behind > 0:** Include a `[STALE_BRANCH]` warning in the context
   brief listing what was merged to main since the branch point. Inject into ALL
   reviewer prompts: "The code under review is {N} commits behind {default_branch}.
   These changes were merged since: {list}. Before claiming code or features are
   'missing', check whether they exist on {default_branch} via
   `git show {default_branch}:{filepath}`."

   **If in a git worktree specifically** (detected via `git worktree list`):
   add extra emphasis — worktrees are commonly used for isolated development and
   are especially prone to divergence from main.

   **Record in Context Brief:** Add a "Codebase State" section with: branch name,
   commits behind main, key PRs merged since branch point, worktree status.

4. **Knowledge Mining (tiered loading)** — Mine local knowledge using a 3-tier
   approach to minimize token waste while maximizing relevant context:

   **L0 — Index scan (~100 tokens each).** Read only index lines and frontmatter
   `description` fields. Filter for relevance to the work under review.
   - `MEMORY.md` — read index lines only (each ~150 chars). Match keywords from
     the work's content type, domain, and technology signals.
   - `~/.claude/skills/*/SKILL.md` — read only the YAML `description:` field
     (glob + grep for `^description:`). Match against detected content signals.
   - `CLAUDE.md` — always load (small, high-authority).

   **L1 — Summary scan (~500 tokens each).** For L0-matched items only, read
   frontmatter + first paragraph to confirm relevance.
   - Memory files (`feedback_*.md`, `project_*.md`) — read first 20 lines.
     `feedback_*.md` files matching the review domain get automatic L2 promotion
     (past corrections are HIGHEST PRIORITY).
   - Skill files — read the `description:` + `## When NOT to Use` section.
   - `lessons.md` — scan for lines matching review domain keywords.

   **L2 — Full content (no limit).** Only for confirmed-relevant items from L1.
   - Read the complete file for items that passed L1 relevance check.
   - Typical yield: 3-8 files at L2 out of 50+ candidates at L0.

   **Deduplication:** if the same insight appears in multiple sources, include
   only the most specific version (project > global > skill).

5. **Web Research** (deep research mode only) — Triggers when user requests
   "deep review" or 5+ keywords from a signal group with no built-in checklist.
   Cap at 2 web searches. Tag findings with [WEB]. If the built-in domain
   checklist already covers the signal group, web research is skipped unless
   explicitly requested.

6. **Context Brief** — Compile into structured brief with sections: Codebase
   State, System Documentation Found, Referenced Files, Safety Mechanisms,
   Knowledge Mining Results, Web Research Findings, Domain Checklist, Context Gaps.

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
5. **Fresh-Reader Reviewer** (50%) — reads the doc COLD as a newcomer with zero prior context: catches journey-narration ("now built", "corrected this round", dated probes, "was X — now Y", "superseded"), assumed prior knowledge / undefined jargon / internal nicknames, and feasibility-vs-built identity confusion — defects Clarity/Accuracy/Completeness routinely miss. **Strongly recommended (replace Devil's Advocate) for any near-final delivery / feasibility / status / handoff document, especially one heavily iterated or mass-rewritten.** Dispatch via the `Fresh-Reader Delivery Reviewer` agent.

**For subjective-quality deliverables (Assessment mode — strategy / marketing / creative / research output):**
GENERATE 4 domain-tailored adversarial personas (do not reuse the generic sets — saturation comes from generic "is this good?" questions). Each must ask a question that **exposes a difference a generic reviewer misses**, and all four default to **HIGH agreement-intensity** (appreciative personas re-saturate):
1. **Domain-Authenticity Critic** (90%) — "does this ring true to a real practitioner/native of this space, or is it a plausible outsider's caricature?"
2. **Executability / Operator** (90%) — "could I act on this tomorrow? name the concrete next step, number, or channel — any vagueness = a castle in the air."
3. **Decision-Maker / ROI** (90%) — "would I fund or ship this? what's the measurable commitment, and is the claimed upside real or just baseline?"
4. **Intent-Fidelity Critic** (90%) — "does this serve the *specific* brief/brand/audience — or would it read identically for a competitor? (apply the swap test in *Assessment Mode*.)"
Tailor each archetype's wording to the deliverable's actual domain. *Worked example — a China beauty-brand strategy report:* 化妆品合规审查员 (regulatory, with veto) · 本土电商操盘手 (executability) · 比稿甲方 / ROI 审计官 (decision-maker) · 成分党品牌死忠 (intent fidelity). Reasoning strategies: adversarial simulation + first-principles.

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
| Fresh-Reader Reviewer | Cold first-read | "You have zero prior context. Read as a newcomer; flag anything that narrates the team's journey, assumes prior knowledge, or leaves the doc self-contradictory." |
| Auto-added specialists | Checklist verification | "Use your domain checklist. Verify each item." |

### Default Evaluation Criteria

Correctness, Completeness, Quality, Edge Cases (override if user specifies).
*(Assessment mode overrides these — see below.)*

### Assessment Mode (v3.6) — quality discrimination, not defect-finding

Triggers when the work is a **subjective-quality deliverable** (a strategy report, marketing/creative copy, a pitch, a research synthesis) rather than code/plan/docs. The other modes hunt discrete defects; here the failure mode is **saturation** — every competent draft *reads* good, so a generic "rate 0–10" panel hands out 8–9s to everything, **including a confident-but-empty draft.** The job is to *discriminate* quality, which needs different machinery:

**1. Subtract-points + veto (not add-points).** Start each axis at 10; adversarial personas *deduct* 1–2 per hole, cliché, or unsupported claim. A fatal domain violation (regulatory red-line, factually impossible claim) is a **veto → 0 on that axis**, not averaged away. Add-points scoring produces agreeable 9s; subtract-points forces "good" to mean "survived the deductions."

**2. The swap test (cheap specificity probe).** Replace the subject's proper noun (brand/product/person) with a plausible competitor's. If the deliverable still reads as true, it has **zero specificity** — flag it. Automatable; directly attacks "generic draft scores high."

**3. Out-of-band fact-check for currency.** A persona **cannot** tell a confident *current* fact from a confident *stale* one — it has no ground truth. So any freshness / factual / quantitative claim (market sizes, prices, dates, "latest X") must be verified against a curated checklist built from primary sources **outside** the panel and scored deterministically. Never let a persona "rate freshness." See skill `llm-judge-cant-detect-stale-or-fabricated-grounding`.

**4. THE CONTROL-VALIDATION GATE — the signature step.** Before trusting any Assessment score, calibrate the panel: construct a **degenerate control** — a version of the deliverable made with NO real input (generic template / no research / subject name find-replaced) — and run it through the SAME personas. **A persona is valid only if it scores the control clearly below the real deliverable (rule of thumb: control < 3/10).** A persona that rates the degenerate control as highly as the real one is non-discriminating sycophancy → **drop it and report it.** This is the assessment analogue of the Phase 6 CONSENSAGENT sycophancy check, but it tests the panel against a **known-bad floor** rather than against reviewer agreement — run it whenever scores look suspiciously uniform, in ANY mode.

**Assessment criteria** (override the defaults): Insight (a falsifiable, non-obvious claim — not rhetoric like "counter-intuitive"), Specificity (survives the swap test), Executability, Domain-authenticity, plus an **out-of-band** Currency axis. Demote/merge generic "completeness" (rewards padding) and "readability" (everyone writes pretty) — they're the weakest discriminators.

**Report:** state mode = Assessment; per-axis scores *with the deductions that produced them*; swap-test result; out-of-band currency verdict; and the control-validation result (which personas passed / were dropped). If no control was run, cap confidence at Medium and say so.

*Worked example (monksIQ China brand-report bake-off, 2026-06):* a 6-judge panel's four generic quality axes all saturated at 8–9.5 — a **no-data control scored as high as real reports** — and only an out-of-band freshness checklist plus adversarial domain personas (compliance-with-veto / e-commerce-operator / pitch-ROI / brand-fidelity) discriminated. Asked to design their own panel, the strongest models independently proposed subtract-points, the swap test, and this control-validation gate.

### VoltAgent Integration (v2.9)

VoltAgent specialist agents (130+ across 10 families) have built-in domain
expertise via their system prompts, making them stronger reviewers than generic
persona-prompted agents. When available, the panel should **upgrade** personas
to VoltAgent agents. Full catalog: github.com/VoltAgent/awesome-claude-code-subagents
(a point-in-time snapshot of every agent the mapping tables below may reference
is vendored at `references/voltagent-catalog.json`; run `scripts/refresh-voltagent-catalog.sh`
to regenerate it and `scripts/voltagent-catalog-check.sh` to detect drift).

**Step 1: Check availability.** During Phase 1 setup, check whether VoltAgent
agents are available by scanning the system-reminder agent list for any
`voltagent-*` prefixed agents. Note which families are installed.

**Step 2: Map personas to specialists.** Use this mapping table.
*(When launching any persona via `subagent_type`, ALWAYS pass `model: "opus"`. v2.14.)*

#### Core Persona Mapping (review panel built-in personas)

| Persona | Primary VoltAgent | Alt VoltAgent | Fallback |
|---|---|---|---|
| Correctness Hawk | `voltagent-qa-sec:code-reviewer` | `voltagent-qa-sec:debugger` | Generic + prompt |
| Architecture Critic | `voltagent-qa-sec:architect-reviewer` | `voltagent-infra:cloud-architect` | Generic + prompt |
| Security Auditor | `voltagent-qa-sec:security-auditor` | `voltagent-qa-sec:penetration-tester` | Generic + prompt |
| Code Quality Auditor | `voltagent-qa-sec:code-reviewer` | | Generic + prompt |
| Feasibility Analyst | `voltagent-data-ai:data-scientist` | `voltagent-biz:business-analyst` | Generic + prompt |
| Risk Assessor | `voltagent-qa-sec:chaos-engineer` | `voltagent-domains:risk-manager` | Generic + prompt |
| Performance Specialist | `voltagent-qa-sec:performance-engineer` | `voltagent-infra:sre-engineer` | Generic + prompt |
| Stakeholder Advocate | `voltagent-biz:product-manager` | `voltagent-biz:business-analyst` | Generic + prompt |
| Devil's Advocate | Generic + prompt | | (intentionally generic) |
| Data Quality Auditor | `voltagent-data-ai:data-analyst` | `voltagent-data-ai:data-engineer` | Generic + prompt |
| Reliability/SRE | `voltagent-infra:sre-engineer` | `voltagent-infra:devops-incident-responder` | Generic + prompt |
| DevOps/Infra | `voltagent-infra:devops-engineer` | `voltagent-infra:platform-engineer` | Generic + prompt |
| Database Specialist | `voltagent-data-ai:database-optimizer` | `voltagent-data-ai:postgres-pro` | Generic + prompt |
| Clarity Editor | `voltagent-dev-exp:documentation-engineer` | `voltagent-biz:technical-writer` | Generic + prompt |
| Technical Accuracy | `voltagent-qa-sec:code-reviewer` | | Generic + prompt |
| Completeness Checker | `voltagent-qa-sec:qa-expert` | | Generic + prompt |
| Fresh-Reader Reviewer | `Fresh-Reader Delivery Reviewer` (custom cold-read agent) | | Generic + prompt |

#### Signal-Detected Specialist Mapping (auto-added by content signals)

When content signals trigger auto-addition of specialist reviewers, use these
VoltAgent agents instead of generic personas:

| Content Signal | Auto-Add Persona | VoltAgent `subagent_type` |
|---|---|---|
| Delivery / feasibility / status / handoff doc (esp. heavily iterated or mass-rewritten) | Fresh-Reader Reviewer | `Fresh-Reader Delivery Reviewer` |
| SQL / database queries | Data Quality Auditor | `voltagent-data-ai:database-optimizer` |
| Terraform / IaC | Infrastructure Reviewer | `voltagent-infra:terraform-engineer` |
| Terragrunt | Infrastructure Reviewer | `voltagent-infra:terragrunt-expert` |
| Docker / containers | Container Reviewer | `voltagent-infra:docker-expert` |
| Kubernetes / k8s | K8s Reviewer | `voltagent-infra:kubernetes-specialist` |
| CI/CD / pipelines | Pipeline Reviewer | `voltagent-infra:deployment-engineer` |
| ML / model training | ML Reviewer | `voltagent-data-ai:ml-engineer` |
| LLM / prompts | LLM Reviewer | `voltagent-data-ai:llm-architect` |
| NLP / text processing | NLP Reviewer | `voltagent-data-ai:nlp-engineer` |
| React / frontend | Frontend Reviewer | `voltagent-lang:react-specialist` |
| TypeScript | TS Reviewer | `voltagent-lang:typescript-pro` |
| Python | Python Reviewer | `voltagent-lang:python-pro` |
| Go / Golang | Go Reviewer | `voltagent-lang:golang-pro` |
| Rust | Rust Reviewer | `voltagent-lang:rust-engineer` |
| Java / Spring | Java Reviewer | `voltagent-lang:java-architect` |
| .NET / C# | .NET Reviewer | `voltagent-lang:csharp-developer` |
| Ruby / Rails | Rails Reviewer | `voltagent-lang:rails-expert` |
| PHP / Laravel | PHP Reviewer | `voltagent-lang:laravel-specialist` |
| Swift / iOS | iOS Reviewer | `voltagent-lang:swift-expert` |
| Flutter / Dart | Flutter Reviewer | `voltagent-lang:flutter-expert` |
| GraphQL | GraphQL Reviewer | `voltagent-core-dev:graphql-architect` |
| WebSocket / real-time | Real-time Reviewer | `voltagent-core-dev:websocket-engineer` |
| Microservices | Architecture Reviewer | `voltagent-core-dev:microservices-architect` |
| API design | API Reviewer | `voltagent-core-dev:api-designer` |
| Network / DNS / routing | Network Reviewer | `voltagent-infra:network-engineer` |
| Azure | Azure Reviewer | `voltagent-infra:azure-infra-engineer` |
| Active Directory | AD Security Reviewer | `voltagent-qa-sec:ad-security-reviewer` |
| PowerShell | PowerShell Reviewer | `voltagent-qa-sec:powershell-security-hardening` |
| Compliance / GDPR / SOC2 | Compliance Reviewer | `voltagent-qa-sec:compliance-auditor` |
| Accessibility / a11y | Accessibility Reviewer | `voltagent-qa-sec:accessibility-tester` |
| Error handling / logging | Error Reviewer | `voltagent-qa-sec:error-detective` |
| Test automation | Test Reviewer | `voltagent-qa-sec:test-automator` |
| Blockchain / Web3 | Blockchain Reviewer | `voltagent-domains:blockchain-developer` |
| Payment / fintech | Fintech Reviewer | `voltagent-domains:fintech-engineer` |
| IoT / embedded | Embedded Reviewer | `voltagent-domains:embedded-systems` |
| SEO | SEO Reviewer | `voltagent-domains:seo-specialist` |
| Quant / financial models | Quant Reviewer | `voltagent-domains:quant-analyst` |
| Vue / Nuxt | Vue Reviewer | `voltagent-lang:vue-expert` |
| Angular | Angular Reviewer | `voltagent-lang:angular-architect` |
| Next.js | Next.js Reviewer | `voltagent-lang:nextjs-developer` |
| React Native / Expo | Mobile Reviewer | `voltagent-lang:expo-react-native-expert` |
| Electron / desktop apps | Desktop Reviewer | `voltagent-core-dev:electron-pro` |
| Django | Django Reviewer | `voltagent-lang:django-developer` |
| FastAPI | FastAPI Reviewer | `voltagent-lang:fastapi-developer` |
| Spring Boot | Spring Boot Reviewer | `voltagent-lang:spring-boot-engineer` |
| Symfony | Symfony Reviewer | `voltagent-lang:symfony-specialist` |
| C / C++ | C++ Reviewer | `voltagent-lang:cpp-pro` |
| Kotlin | Kotlin Reviewer | `voltagent-lang:kotlin-specialist` |
| Elixir / Phoenix | Elixir Reviewer | `voltagent-lang:elixir-expert` |
| MLOps / model deployment | MLOps Reviewer | `voltagent-data-ai:mlops-engineer` |
| Reinforcement learning | RL Reviewer | `voltagent-data-ai:reinforcement-learning-engineer` |
| Prompt optimization / evals | Prompt Reviewer | `voltagent-data-ai:prompt-engineer` |
| AI systems / agentic apps | AI Systems Reviewer | `voltagent-data-ai:ai-engineer` |
| Database admin / replication / HA | DBA Reviewer | `voltagent-infra:database-administrator` |
| Incident response / outages | Incident Reviewer | `voltagent-infra:incident-responder` |
| Windows Server / IIS | Windows Reviewer | `voltagent-infra:windows-infra-admin` |
| Cloud security / secrets mgmt | Cloud Security Reviewer | `voltagent-infra:security-engineer` |
| CLI tools / TUIs | CLI Reviewer | `voltagent-dev-exp:cli-developer` |
| MCP servers / tools | MCP Reviewer | `voltagent-dev-exp:mcp-developer` |
| Refactoring / legacy modernization | Refactoring Reviewer | `voltagent-dev-exp:refactoring-specialist` |
| Build systems / bundlers | Build Reviewer | `voltagent-dev-exp:build-engineer` |
| Dependencies / supply chain | Dependency Reviewer | `voltagent-dev-exp:dependency-manager` |
| Git workflows / branching | Git Workflow Reviewer | `voltagent-dev-exp:git-workflow-manager` |
| Game dev / engines | Game Reviewer | `voltagent-domains:game-developer` |
| API docs / OpenAPI | API Docs Reviewer | `voltagent-domains:api-documenter` |
| Legal / licensing / contracts | Legal Reviewer | `voltagent-biz:legal-advisor` |
| UX research / usability | UX Research Reviewer | `voltagent-biz:ux-researcher` |

#### Multi-Agent Orchestration Mapping (for pre/post-panel phases)

All launches below MUST pass `model: "opus"` explicitly (v2.14).

| Review Phase | VoltAgent `subagent_type` | Use When |
|---|---|---|
| Data Flow Trace (Phase 2) | `voltagent-data-ai:data-engineer`, `model: "opus"` | Trace data paths, document schemas at boundaries (v2.14) |
| Completeness Audit (Phase 8) | `voltagent-meta:knowledge-synthesizer`, `model: "opus"` | Synthesize what the panel missed |
| Claim Verification (Phase 10) | `voltagent-qa-sec:code-reviewer`, `model: "opus"` | Verify line-number citations |
| Severity Verification (Phase 11) | `voltagent-qa-sec:debugger`, `model: "opus"` | Read actual code for P0/P1 findings |
| Tier Refinement Advisor (Phase 12b) | Generic, `model: "opus"` | (must be domain-neutral to refine tiers) |
| Verification Agents (Phase 13) | Persona-matched — see Phase 13 table, `model: "opus"` | Each agent matched to claim type |
| Supreme Judge (Phase 14) | Generic, `model: "opus"` | (judge must be domain-neutral) |
| Judge-Output Verifier (Phase 14.5) | Generic, `model: "opus"` | Re-verifies judge-introduced P0/P1 against ground truth via grep/Read/git (v3.2.0) |
| HTML Report Agent (Phase 15.3) | `voltagent-lang:javascript-pro`, `model: "opus"` | Generate interactive HTML dashboard with expandable issue cards (v2.15). Reads from disk: Phase 15.1 report + Phase 15.2 process history + rendering spec from prompt-templates.md (v2.16.4). Loads Tailwind, Chart.js, and Prism.js via CDN. |
| Merge Agent (Phase 16) | `voltagent-meta:knowledge-synthesizer`, `model: "opus"` | Deduplicate + score stability in multi-run mode (v2.14) |

**Step 3: Suggest installation when beneficial.** If a selected persona would
benefit from a VoltAgent agent but the agent family is not available, suggest
installation to the user:

> "This review would benefit from VoltAgent specialist agents for deeper
> domain-specific analysis. You can install the relevant families with:
>
> **Quick install (CLI):**
> `claude plugin install voltagent-qa-sec`  — security, code review, testing
> `claude plugin install voltagent-data-ai` — data science, ML, databases
> `claude plugin install voltagent-infra`   — DevOps, cloud, Terraform
> `claude plugin install voltagent-lang`    — language specialists (TS, Python, Go, Rust)
> `claude plugin install voltagent-biz`     — product, business analysis
> `claude plugin install voltagent-domains` — fintech, blockchain, IoT
>
> **Or browse via marketplace:**
> `/plugin marketplace add VoltAgent/awesome-claude-code-subagents`
> then `/plugin install <name>@voltagent-subagents`
>
> Continue without them? They're optional — the review will still work
> with generic persona-prompted agents."

Only suggest installation **once per session**. List only the families relevant
to the detected content signals, not all 10. If the user declines or the agents
aren't available, proceed with the generic fallback silently.

**Step 4: Launch with `subagent_type` AND `model: "opus"`.** When launching Phase 3 agents:
- `subagent_type: "voltagent-qa-sec:code-reviewer", model: "opus"` (when available)
- Omit `subagent_type`, pass `model: "opus"` explicitly (generic agent fallback)

**CRITICAL (v2.14):** ALWAYS pass `model: "opus"` even when using `subagent_type`.
VoltAgent agents may declare their own default model (sonnet, haiku) in their
frontmatter. Without an explicit override, the panel silently runs on mixed
models, producing different reasoning depths across runs. The VoltAgent
agent's value lives in its system prompt and tool access, NOT its default
model. Forcing opus preserves the domain expertise while guaranteeing
consistent reasoning depth. This fix resolves an invisible source of
cross-run variance documented in the v2.10→v2.14 consistency analysis.

The persona prompt is STILL included even when using VoltAgent agents — it
provides the review-panel-specific context (agreement intensity, reasoning
strategy, evaluation criteria) that the VoltAgent agent doesn't have natively.

---

## Live-State Claim Discipline (v3.3.0)

Resolves [#40](https://github.com/wan-huiyan/agent-review-panel/issues/40). A
panel reading source code can verify what a script or manifest WILL do if
executed — it cannot verify what production infrastructure IS doing right now.
Conflating the two produced a false-positive P0 "IAM/IAP divergence" finding
that survived all 5 reviewers, 3 debate rounds, and the Supreme Judge: the
agents read `echo "gcloud ... --role=..."` lines in two deploy scripts
(operator-facing documentation printed to the terminal at deploy-completion
time) as if they were the live IAM bindings of the deployed service. A single
`gcloud run services describe` would have falsified it in 30 seconds.

This discipline applies to any finding that asserts a fact about **live
state** — deployed IAM/IAP/auth config, a running cron schedule, a BigQuery
table's partition key, a production env var, a load balancer's routing. It is
NOT limited to security. It is injected into Phase 3 reviewer prompts, the
Phase 5 debate prompt, Phase 11 severity verification, and the Phase 14 judge
prompt.

### Rule 1 — Declarative vs. imperative vs. documentation

Reviewers must distinguish three things a source file can contain:

| Category | Example | What it proves |
|---|---|---|
| **Declarative config** | `gcloud run deploy ... --no-allow-unauthenticated`, a Terraform resource, a YAML manifest | The deploy WILL create this config if run — still not proof it WAS run |
| **Imperative documentation** | `echo "  gcloud beta run services add-iam-policy-binding ..."`, a comment, a README snippet, a printed "next steps" blurb | A human is being TOLD to run this later. The script itself does not. |
| **Live state** | output of `gcloud ... describe` / `... get-iam-policy`, `bq show`, `aws ... describe-*`, `kubectl get`, `crontab -l` | What production actually is right now |

Lines inside `echo "..."`, `print(...)`, comments, heredocs echoed to a
terminal, or string literals in "usage" / "next steps" blocks are
**documentation, not configuration**. They are never evidence for a live-state
claim. Configuration claims must come from declarative deploy flags / manifests;
live-state claims must come from live `describe`-class output.

### Rule 2 — Live-state claims need live evidence

Every finding that asserts a live-infrastructure or runtime-state fact carries
one of two epistemic tags:

- **`[LIVE-VERIFIED]`** — backed by output from a live-state command
  (`gcloud ... describe` / `... get-iam-policy`, `bq show`, `aws ... describe-*`,
  `kubectl get`, `crontab -l`, etc.) that the panel actually ran or that the
  user supplied.
- **`[STATIC-INFERENCE]`** — inferred from source code, config files, or deploy
  scripts only. The panel did not (or could not) observe live state.

A `[STATIC-INFERENCE]` live-state claim is capped at **P1**, no matter how many
reviewers cite it. P0 ("block the demo") requires `[LIVE-VERIFIED]` — or the
finding must be reworded as "the deploy script would configure X" (a
`[PLAN_RISK]`, not an `[EXISTING_DEFECT]`). When the panel lacks the tools to
obtain live evidence, the finding must say so explicitly rather than inferring.

### Rule 3 — Consensus does not compound on a shared artifact

When 2+ reviewers reach the same conclusion by reading the **same** source
lines, that is consensus on an *interpretation*, not independent verification
of a *fact*. It must not be promoted to `[VERIFIED]` or used to justify P0.
Phase 6 (Sycophancy Detection) flags this pattern; the judge tags it
`[STATIC-INFERENCE-CONSENSUS]` and requires independent live verification
before any P0 promotion. Cross-citation chains (Security F3 → Architecture F4
→ DA CF2) over the same artifact lines are a single source, not three.

### Rule 4 — Pre-promotion falsification check

Before any finding is promoted to P0 — in debate (Phase 5) or by the judge
(Phase 14) — answer two questions:

1. **What single observation would prove this finding wrong?**
2. **Is that observation cheap to obtain?**

If a P0 can be falsified by one read-only command (a `describe`, a `show`, a
`grep`) and no agent ran it, the finding is at most P1 until verified. Record
the falsification test alongside the finding.

---

## Phase 2: Data Flow Trace (v2.14)

A dedicated agent traces data through the critical path(s) of the work
BEFORE reviewers begin, producing a structured Data Flow Map. This phase
specifically targets **composition defects** — bugs where two individually-
correct functions produce incorrect results together. These bugs are
structurally invisible to reviewers who read each function in isolation.

Research foundations: Meta semi-formal certificate prompting (2026, 78%→93%
accuracy), LLMDFA (NeurIPS 2024, 87% precision), RepoAudit (ICML 2025,
78% precision with demand-driven exploration), BugLens (ASE 2025, 7x false
positive reduction), ZeroFalse (2025, F1 0.955).

### Skip Conditions

- Pure plans/design (no code)
- Pure documentation (no code)
- Code with no detectable data transforms (pure API routing, static config,
  declarative-only files)

When Phase 2 is skipped, note the reason in the Context Brief and the report
header. Proceed directly to Phase 3.

### Tier System

Three tiers, user-selectable via `--trace {tier}` or natural language:

| Tier | Trigger Phrases | Paths Traced | Overhead | Token Budget |
|------|----------------|--------------|----------|--------------|
| **Standard** (default) | no modifier, "review" | Single most important path | ~5 min | ~8k |
| **Thorough** | "thorough review", "thorough trace", `--trace thorough` | Top 3 paths + transform completeness | ~15 min | ~20k |
| **Exhaustive** | "exhaustive review", "trace everything", "catch all bugs", `--trace exhaustive` | ALL paths from every entry point | No limit | No limit |

**Tier detection priority:**
1. Explicit `--trace {tier}` flag
2. Natural language keywords in user's original prompt
3. Default: Standard

"Deep review" (which triggers web research) combines with Standard trace
unless the user also specifies a trace tier.

### Critical Path Identification (orchestrator, not subagent)

Before launching the Data Flow Tracer, the orchestrator identifies entry
points and ranks them by data complexity:

1. **Find entry points.** Scan for structural markers:
   - Web frameworks: `@app.route`, `@router.get/post`, `@api_view`, Django CBVs
   - CLI: `@click.command`, `@app.command` (Typer), `if __name__ == "__main__":`, argparse
   - Background: `@app.task` (Celery), AWS `lambda_handler`, Kafka/SQS consumers
   - Scripts: `main()`, top-level script execution

2. **Rank by data complexity.** Count on each path:
   - Number of function calls
   - Number of data transforms (map/filter/reduce/apply/merge/join/groupby/pivot)
   - Number of I/O boundaries (DB, HTTP, file, queue)
   - Presence of transform/back-transform pairs

3. **Select paths per tier:**
   - Standard: top-ranked path only
   - Thorough: top 3 paths
   - Exhaustive: all paths

### The Data Flow Tracer Agent

Single agent (`model: "opus"`). VoltAgent mapping: `voltagent-data-ai:data-engineer`
primary, `voltagent-qa-sec:code-reviewer` fallback. **Always pass `model: "opus"`**
even when using `subagent_type`.

Uses the **semi-formal certificate approach** from Meta's 2026 agentic code
reasoning research. At each function boundary on the critical path, the agent
produces a certificate:

```
FUNCTION: {name} ({file}:{line})
INPUT_SCHEMA:
  - parameter types (declared or inferred)
  - known constraints at call site
  - which parameters are externally controlled
TRANSFORM:
  - what the function does
  - key assignments and branches
  - external calls (I/O, DB, modules)
OUTPUT_SCHEMA:
  - return type
  - tainted/derived fields
  - guaranteed invariants
COMPOSITION_CHECK: (vs next function)
  - Does OUTPUT_SCHEMA satisfy next INPUT_SCHEMA?
  - Fields required but not guaranteed?
  - Tainted fields reaching sensitive parameters?
INVARIANT_STATUS:
  - preserved or violated invariants
  - violations flagged as P0 candidates
```

See `references/prompt-templates.md` for the full Phase 2 Data Flow Tracer
prompt.

### Mandatory Invariant Checks (at every boundary)

1. **Schema preservation** — output schema matches next function's expected input
2. **Transform/back-transform completeness** — list forward transforms (log,
   encode, serialize) and back-transforms (exp, decode, deserialize). Any
   field in forward but not back is a P0 candidate. See the Transform/Back-
   Transform Completeness checklist in `references/signals-and-checklists.md`.
3. **Row count stability** — joins/merges/reindex/groupby should not silently
   add or remove rows
4. **Null semantics** — `fillna(0)` does not destroy meaningful missingness
5. **Temporal consistency** — date filters applied to all date columns;
   ALL instances of an excluded event (e.g., BOTH Christmases) handled

### Output and Integration with Phase 3

The Data Flow Tracer produces a **Data Flow Map** containing:
- List of paths traced
- Per-function certificates
- Invariant violations table (P0 candidates)
- Transform completeness table
- Clean paths (where all invariants hold)

**Integration with Phase 3:** The Data Flow Map is injected into every
reviewer's Phase 3 prompt as dedicated context. Invariant violations are
flagged as P0 candidates; reviewers must either validate them (agree they're
real P0s) or explicitly challenge them with reasoning. Reviewers are NOT
required to agree with the tracer — this is an additional input, not a
mandate.

When no violations are found, reviewers receive a short "clean trace"
confirmation instead.

---

## Phase 3: Independent Review (Round 0)

Launch ALL reviewer agents **in parallel** using Agent tool with `model: "opus"`.
When VoltAgent integration is active, use `subagent_type` from the mapping table.
Each gets the structured prompt from `references/prompt-templates.md` (Phase 3
template) with their persona, agreement intensity, reasoning strategy, context
brief, and the full work content inside injection boundaries. The prompt also
carries the Live-State Claim Discipline (Rules 1–2): reviewers must tag every
live-infrastructure/runtime-state claim `[LIVE-VERIFIED]` or `[STATIC-INFERENCE]`
and must not treat `echo`/comment/usage-blurb lines as configuration.

Collect all N independent reviews.

**Output (v3.1.0+):** Each reviewer subagent writes its full review to
`state/reviewer_<name>_phase_3.md` and returns only the path + a ≤50-word
summary. The orchestrator does NOT hold verbatim reviews in its window.

**Persistent reviewers (v3.8.0):** these Phase 3 spawns are the ONLY reviewer
spawns of the run — Phases 4, 5, and 7 are driven by SendMessage to these same
agents (see Orchestrator Efficiency Discipline). If SendMessage to an agent
fails or is unavailable, fall back to a fresh spawn that reads that persona's
prior state files from disk. Record each spawn result's `agentId` into the
persona → agentId map as you launch — that id is the only address Phases 4/5/7
can use (see Addressing persistent reviewers).

**Blocked reviewers (v3.9.0).** A blind reviewer's well-formed "no findings"
review passes every Phase 13.5 check (existence, size, headers), so its silence
reads as agreement. A **BLOCKED reviewer is never a clean vote.**
A blocked reviewer writes `state/reviewer_<slug>_BLOCKED.md` instead of its
required phase file; the orchestrator must re-dispatch once with explicit
materialized paths (a pre-generated diff file, a checked-out worktree). If it is
still blocked, it counts as a missing reviewer: **drop it from the
persistent-reviewer set** — remove it from the persona → agentId map and send it
no Phase 4, 5 or 7 prompt — and let the existing COMPRESSED RUN machinery report
it. Never let a BLOCKED return pass silently into the judge's input as
consensus.

---

## Phase 4: Private Reflection

Send the Phase 4 prompt to each **persistent reviewer agent** via SendMessage
(all sends batched in one message; fresh-spawn fallback reads the persona's
Phase 3 state file). Each works from ONLY their own review. They re-read
source, rate confidence per finding (High/Medium/Low), note new issues,
identify most/least defensible findings. See `references/prompt-templates.md`.

**Output (v3.1.0+):** Each reviewer's reflection is written to
`state/reviewer_<name>_phase_4.md`. Subagent returns only path + ≤50-word
summary.

---

## Phase 5: Debate (Rounds 1-3, adaptive)

Each round, send the debate prompt to every **persistent reviewer agent** via
SendMessage (all sends batched in one message; fresh-spawn fallback reads the
persona's prior state files). Each receives their own review + reflection,
all others' feedback, and unresolved points from previous round.

**Output (v3.1.0+):** Each reviewer's per-round debate response is written
to `state/reviewer_<name>_phase_5_round<R>.md` (R = 1, 2, or 3). Round 1 is
mandatory; rounds 2 and 3 follow the existing convergence-based skip rules.
Subagent returns only path + ≤50-word summary.

**Pre-promotion falsification check (v3.3.0).** Before any finding is promoted
to — or kept at — P0 in any debate round, the reviewer must state the single
observation that would falsify it and whether that observation is cheap to
obtain (see Live-State Claim Discipline Rule 4). A P0 that one read-only command
could falsify, with no agent having run it, is capped at P1 until verified.

### Phase 6: Round Summarization

After each round, summarize (no agent needed):
- **Resolved this round** — who agreed, what convinced them
- **Still in dispute** — with inlined source excerpts (max 10 lines per dispute,
  first 5 + last 5 if longer; max 3 disputes). If a reviewer's claim cannot be
  traced to a specific source location, tag `[source not cited by reviewer]`.
- **New discoveries** — from which reviewer

### Sycophancy Detection (CONSENSAGENT)

Count position changes toward majority. If >50% lack new evidence → inject
sycophancy alert into next round prompt for all reviewers.

**Shared-artifact consensus (v3.3.0).** Also flag when 2+ reviewers agree on a
claim by reading the **same** source lines without independent verification —
including cross-citation chains where each reviewer cites the previous one's
finding rather than the source. This is consensus on an *interpretation*, not
on a *fact*: it does not compound to `[VERIFIED]` and must not justify P0. Tag
such points `[STATIC-INFERENCE-CONSENSUS]` (Live-State Claim Discipline Rule 3)
and route them to verification before any P0 promotion.

### Convergence Check

- All disputes minor/stylistic → stop
- Substantive disagreements remain → continue
- New discoveries still emerging → continue
- Maximum 3 rounds regardless

---

## Phase 7: Blind Final Assessment

Send the blind-final prompt to every **persistent reviewer agent** via
SendMessage, one final time (batched; fresh-spawn fallback as above). Each
gives final score, top 3 points, recommendation, one-line verdict. Others do
NOT see these.

**Output (v3.1.0+):** Each reviewer's blind final is written to
`state/reviewer_<name>_phase_7.md`. Subagent returns only path + ≤50-word
summary of new findings.

---

## Phase 8: Completeness Audit

Single agent (`model: "opus"`) hunts for what the entire panel missed. Does NOT
evaluate quality — only finds overlooked details, edge cases, constants, code.
See `references/prompt-templates.md` for full prompt.

**Mandatory audit checks (in addition to general completeness):**
- **Temporal scope verification:** For every claim that excludes, filters, or
  masks a time period, count all instances in the full date range and verify
  each is handled. Example: "excludes Christmas" with 2 years of data must
  exclude BOTH Christmases. This is the #1 class of bug that reviewers miss
  because they focus on the method, not the temporal arithmetic.

**Output (v3.1.0+):** Subagent writes full output to `state/phase_8_audit.md`
and returns only path + ≤50-word summary.

---

## Phase 9: Verification Command Execution (v2.8)

Run up to 5 reviewer `verification_command` entries for P0/P1 findings (P0 first).
Validate read-only (grep/cat/head/tail/wc only), execute via Bash, annotate:
`[CMD_CONFIRMED]`, `[CMD_CONTRADICTED]` (demote 1 level), `[CMD_INCONCLUSIVE]`,
`[CMD_FAILED]`. **Advisory, not gating** — demotes but does not delete.
Skip this phase if no verification commands were provided.

---

## Phase 10: Claim Verification

Single agent (`model: "opus"`) checks all reviewer citations against source.
Classifies each as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED],
or [UNVERIFIABLE]. Results feed into judge prompt.

**Output (v3.1.0+):** Subagent writes full output to `state/phase_10_claim_verification.md`
and returns only path + ≤50-word summary.

---

## Phase 11: Severity Verification (v2.7)

Single agent (`model: "opus"`) that reads the actual codebase to verify every
P0 and P1 finding before the judge sees them. This phase exists because panels
systematically overstate severity when they lack runtime context (v2.6
benchmark: 2/3 P0 findings were overstated after code investigation).

**For each P0/P1 finding, the agent must:**

1. **Classify as `[EXISTING_DEFECT]` or `[PLAN_RISK]`**
   - `[EXISTING_DEFECT]`: The bug exists in the current running code right now
   - `[PLAN_RISK]`: The risk would only materialise if the plan is implemented as written
   - P0 severity requires `[EXISTING_DEFECT]`. A `[PLAN_RISK]` is at most P1.

1b. **Live-state claim classification (v3.3.0)** — If the finding asserts a fact
   about live infrastructure or runtime state (deployed IAM/IAP/auth config, a
   running cron schedule, a production env var, a BigQuery partition key, a load
   balancer's routing), apply the Live-State Claim Discipline:
   - Tag `[LIVE-VERIFIED]` only if backed by live `describe`-class command
     output the panel ran or the user supplied; otherwise tag `[STATIC-INFERENCE]`.
   - A `[STATIC-INFERENCE]` live-state claim is capped at **P1** regardless of
     reviewer count. Do NOT let it stay P0 on consensus alone.
   - Reject `echo`/comment/usage-blurb lines as evidence — those are
     documentation, not configuration. A claim resting only on such lines is
     `[STATIC-INFERENCE]` at best and is frequently `[INACCURATE]`.

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

5. **External domain claim detection and web verification (v2.16.3)**

   **Why this exists:** Consensus P0 findings that depend on external domain
   knowledge bypass the Phase 12/13 dispute-verification pipeline entirely
   (because there is no dispute to trigger it). But all reviewers can be wrong
   the same way — shared model bias or shared domain knowledge gaps. In a real
   engagement (PUMA GA4 audit, 2026-04-09), all 4 reviewers unanimously flagged
   "50 months = GA4 360" as P0 without verifying whether 50 months is even a
   valid GA4 setting. The claim happened to be correct, but the panel had no
   mechanism to verify it. If the source data had been wrong, the panel would
   have confidently presented an incorrect P0.

   **For each P0/P1 finding, classify whether it depends on external knowledge:**

   - **External domain claim:** The finding's validity depends on facts outside
     the reviewed codebase — product feature limits, API behavior, regulatory
     jurisdiction, pricing tiers, platform capabilities, protocol specifications,
     third-party documentation. Examples: "50 months retention means GA4 360",
     "GDPR applies to Mexico", "this API rate-limits at 100 req/s."
   - **Internal claim:** The finding is fully verifiable from the reviewed code,
     config, or documentation. No external knowledge needed.

   **For each finding classified as external domain claim:**
   - Run a web search to verify the specific factual premise (cap: 2 searches
     per claim, 5 claims max per review)
   - Tag result: `[WEB-VERIFIED]` (confirmed by authoritative source),
     `[WEB-CONTRADICTED]` (external source disagrees — demote severity by 1 level),
     `[WEB-INCONCLUSIVE]` (no authoritative source found — flag for judge)
   - Include the source URL and key quote in the verification table
   - Regulatory/jurisdiction claims (e.g., "GDPR applies to X country") are
     ALWAYS classified as external domain claims

   **Extended severity verification table:**

   ```
   | Finding | Severity | Domain Type | Web Result | Source | Adjusted Severity |
   |---------|----------|-------------|------------|--------|-------------------|
   | ...     | P0       | External    | [WEB-VERIFIED] | support.google.com/... | P0 (confirmed) |
   | ...     | P1       | External    | [WEB-CONTRADICTED] | gdpr.eu/... | P2 (demoted) |
   | ...     | P0       | Internal    | N/A        | N/A    | P0 (code-verified) |
   ```

   **Skip condition:** If all P0/P1 findings are internal claims (fully
   verifiable from the reviewed content), skip web verification.

Results feed into the Supreme Judge prompt. The judge MUST reference the
verification table when ruling on disagreements.

**Output (v3.1.0+):** Subagent writes full output to `state/phase_11_severity_verification.md`
and returns only path + ≤50-word summary.

---

## Phase 12: Verification Tier Assignment (v2.11)

After Phases 8–11, collect all **unresolved dispute points** from Phase 6
summaries plus any **high-uncertainty action items** bearing `[SINGLE-SOURCE]`,
`[DISPUTED]`, or `[UNVERIFIED]` labels. Each point is assigned a depth tier that
controls the verification agent's budget and capabilities in Phase 13.

**Skip condition:** If there are zero unresolved disputes and zero unverified
action items, skip Phases 12 and 13 entirely.

### Tier Definitions

| Tier | Budget | Capabilities | When to Use | Example |
|---|---|---|---|---|
| **Light** | ~2k tokens | grep/read only, no web search | Factual claim checkable in a single file or constant lookup | "Reviewer A claims the threshold constant is 0.05 but the report says 0.5 — check the code." |
| **Standard** | ~8k tokens | Multi-file reads, import tracing, static analysis | Claim requires following logic across files or comparing multiple outputs | "Two reviewers disagree on whether the rate-limiter handles concurrent requests — trace the implementation across its dependencies." |
| **Deep** | ~32k tokens | Web search, multi-round reasoning | Requires external knowledge, novel domain, or fundamental disagreement unresolvable from code alone | "Security reviewer claims the PRNG is cryptographically weak for this use case — requires researching current best practices for the specific algorithm." |

### Assignment Pipeline (default: both steps; quick mode: step 1 only)

Tier assignment runs as a two-step pipeline. Step 1 is always fast; step 2
(the judge refinement) is the default but can be skipped by requesting
"quick tier assignment" or "confidence-based tiers only".

**Step 1 — Confidence-Based Draft (always runs; no agent needed):**

The orchestrator derives initial tier assignments from existing Phase 4
confidence ratings and debate round signals:

- **Deep**: Any reviewer rated the claim Low confidence in Phase 4, OR the
  point remained unresolved across 2+ debate rounds, OR the claim requires
  external or runtime knowledge (e.g., production behavior, third-party API
  semantics, literature validation)
- **Standard**: Any reviewer rated Medium/mixed confidence, OR unresolved for
  exactly 1 debate round, OR claim requires cross-file logic tracing
- **Light**: All reviewers rated the claim High confidence AND it is a simple
  checkable fact (file exists, value matches, line present)

Produces a draft tier table:
```
| Point # | Summary | Draft Tier | Signal (confidence ratings + rounds unresolved) |
|---------|---------|------------|------------------------------------------------|
```

**Step 2 — Judge-Advised Refinement (default: on):**

A single Opus agent (Phase 12b) receives the confidence-based draft table and
all supporting context (context brief, Phase 6 summaries, Phase 7 blind finals,
completeness audit, claim and severity verification results). Its job is to
**review and refine** the draft — upgrade, downgrade, or confirm each tier with
reasoning. It also assigns the verification persona per point.

The advisor works from the draft rather than from scratch: the confidence ratings
give it the "ground-level" signal from reviewers who lived through the debate,
and the advisor's role is oversight and correction, not cold assessment from zero.

Final tier table:
```
| Point # | Summary | Draft Tier | Final Tier | Override Reason | Suggested Persona |
|---------|---------|------------|------------|-----------------|-------------------|
```

---

## Phase 13: Targeted Verification Agents (v2.11)

Dispatch one verification agent per collected dispute/action item. All Light and
Standard agents launch **in parallel**; Deep agents can also parallelize unless
they share a scarce resource (e.g., web search rate limits).

### Persona Matching

Classify each claim's type and select the matching verification persona. VoltAgent
agents are preferred when available; fall back to generic + focused prompt.

| Claim Type | Verification Persona | VoltAgent (preferred) |
|---|---|---|
| Statistical / numerical | Data Scientist | `voltagent-data-ai:data-scientist` |
| Code correctness / logic | Code Reviewer | `voltagent-qa-sec:code-reviewer` |
| Architecture / design | Architect Reviewer | `voltagent-qa-sec:architect-reviewer` |
| Security vulnerability | Security Auditor | `voltagent-qa-sec:security-auditor` |
| Performance / scalability | Performance Engineer | `voltagent-qa-sec:performance-engineer` |
| Database / SQL | Database Expert | `voltagent-data-ai:database-optimizer` |
| Infrastructure / ops | SRE | `voltagent-infra:sre-engineer` |
| Framing / narrative | Domain expert | Generic + domain context |
| Business logic / feasibility | Business Analyst | Generic + business context |
| Default / unclear | Verification Agent | Generic + focused prompt |

### Capability Limits by Tier

- **Light** (~2k tokens): May only grep/read/head/tail. Single focused query.
  Return one of `[VR_CONFIRMED]`, `[VR_REFUTED]`, `[VR_INCONCLUSIVE]` with one
  piece of quoted evidence. Do not expand scope beyond the specific claim.
- **Standard** (~8k tokens): May read multiple files, trace imports, run static
  analysis commands. Return verdict with supporting evidence from multiple sources.
  Explore adjacent code only if directly relevant to the dispute.
- **Deep** (~32k tokens): Full agent capabilities including web search and multiple
  reasoning rounds. Return a comprehensive verdict; cite external sources when they
  resolve the dispute. Scope limited to the specific dispute — do not produce a
  second full review.

### Verdict Labels

- `[VR_CONFIRMED]` — Evidence confirms the original claim
- `[VR_REFUTED]` — Evidence contradicts the claim
- `[VR_PARTIAL]` — Claim is partially supported; the agent qualifies what holds
- `[VR_INCONCLUSIVE]` — Insufficient evidence to verify either way
- `[VR_NEW_FINDING]` — Verification revealed an additional issue beyond the dispute

### Verification Round Summary

After all agents complete, compile into a summary table:

```
| Point | Tier | Persona | Verdict | Key Evidence |
|-------|------|---------|---------|--------------|
```

This table is passed to Phase 14 as input item 8.

---

## Phase 13.5: Pre-Judge Verification Gate (v3.1.0)

Before launching the Supreme Judge (Phase 14), the orchestrator MUST verify
that all mandatory phase outputs exist on disk. This gate is the load-bearing
guardrail against silent compression of Phases 4 / 5 / 7.

**Gate logic (orchestrator-executed, no subagent dispatch):**

For each reviewer in the panel, verify these files exist under `state/`
(or `state/run_<N>/` in multi-run mode):

| Required file | Phase | Mandatory |
|---|---|---|
| `reviewer_<name>_phase_3.md` | Independent review | Always |
| `reviewer_<name>_phase_4.md` | Private reflection | Always |
| `reviewer_<name>_phase_5_round1.md` | Debate round 1 | Always (rounds 2/3 per existing skip rules) |
| `reviewer_<name>_phase_7.md` | Blind final | Always |

Plus panel-level files:
- `phase_8_audit.md`
- `phase_10_claim_verification.md`
- `phase_11_severity_verification.md`

**For each required file, run three checks:**

1. **Existence check** — file is present on disk.
2. **Minimum-bytes check** — file size ≥ 500 bytes. Below this is empirically
   a stub (subagent crashed mid-write or returned a placeholder).
3. **Required-headers check** — parse the file and confirm it contains the
   required schema sections for that phase (e.g., a Phase 3 review must
   contain a Score, a Findings section, and severity tags). The exact required
   sections per phase are defined in `references/prompt-templates.md`.

**On gate failure for any file:**

1. Log loudly: `GATE FAIL: <file> missing | stub | malformed`
2. Re-dispatch the subagent for the missing/malformed phase output. **If a
   `reviewer_<slug>_BLOCKED.md` exists for that persona,** the re-dispatch MUST
   supply explicit materialized paths, and that phase counts as unrecoverable
   for banner purposes **even if the retry succeeds** — the persona was blind
   through the debate, so its recovered review never entered it.
3. Re-run the gate after re-dispatch.
4. **Single retry only.** If the second attempt also fails, do NOT block the
   run. Mark the phase as unrecoverable, write the COMPRESSED RUN header in
   Phase 15.1 (see Phase 15.1 spec), and proceed to Phase 14 with the
   partial input. The deliverable is produced with explicit warning rather
   than failing entirely — partial review with loud warning beats no review.

**On full gate pass:** proceed to Phase 14. The COMPRESSED RUN header is NOT
emitted (its absence is the green light) — unless step 2 found a
`reviewer_*_BLOCKED.md`, which forces the header even on a passing gate.

**Debate-presence assertion (v3.5.0) — distinct from per-file compression.**
The per-file gate above re-dispatches an *individual* missing file. But the
dominant real-world failure (2026-06-06 audit: 50/51 runs had no debate) is
the *wholesale* skip — the orchestrator never ran Phase 5 at all and jumps
from independent reviews straight to the judge. So, separately from the
per-file check, **count the `reviewer_*_phase_5_round1.md` files across the
whole panel** (or `state/run_<N>/` in multi-run mode):

- **If the count is ZERO when mode = full panel** (the entire debate phase is
  absent, not just one reviewer's file), this is the **NO-DEBATE** condition.
  Do NOT proceed to Phase 14 silently. Instead:
  1. **Preferred — run Phase 5 now.** Debate was skipped; execute it (round 1
     is non-skippable per the protocol) and re-run this assertion.
  2. **If debate is genuinely unavailable for this execution shape** (e.g.,
     the run is executing as a parallel Workflow / ultracode fan-out with no
     sequential cross-talk primitive — see *Debate-in-Workflow recipe* below),
     stamp the **`[NO-DEBATE]` banner** (Phase 15.1 / 15.3) and lower the
     verdict confidence (cap at Medium). The judge still rules, but the report
     announces that no adversarial cross-examination happened.
- **If the count is ≥ 1**, debate ran; no NO-DEBATE banner. (Individual
  missing round-1 files for *some* reviewers remain a per-file COMPRESSED
  case, handled above.)

**Detection is not solely anchored here.** Phase 13.5 does not fire on every
execution shape (an inline/workflow-shaped run can skip this gate entirely —
that is exactly how the audit's silent skips slipped through). The
load-bearing NO-DEBATE check therefore *also* runs at the Phase 15.1
report-write chokepoint (every completed run passes through it). See Phase
15.1.

**Why bytes + headers, not just existence:** A subagent can write a stub and
crash, leaving an empty/partial file. Existence alone passes the gate on a
stub. Bytes + required-headers makes the check load-bearing. This mirrors
how the Phase 15 verification gate (v2.16.4) validates HTML output
structurally, not just by file presence.

---

## Phase 14: Supreme Judge

Single agent (`model: "opus"`). The launch prompt is ~200 tokens of metadata:
the paths to the state files produced by Phases 3, 4, 5, 7, 8, 10, 11, and
13. The judge **reads state files on demand** using the Read tool — it does
NOT receive verbatim phase outputs pre-stuffed into its launch prompt. This
mirrors the Phase 15.3 HTML-agent pattern (v2.16.4) and caps the judge's
window load even when the panel has produced hundreds of kilobytes of
material.

The judge's ruling is materialized to `state/phase_14_judge_ruling.md` so
Phase 15.1 can later consume it from disk (rather than from chat).

Steps (in order):
0. Review verification results (claims, severity, commands, **and verification round**)
0.5a-b. Verify audit findings, anti-rhetoric assessment
0.5c. Severity dampening — minimum evidence-justified severity. **In Precise mode, findings without code citations cannot exceed P2.** **Live-State Claim Discipline (v3.3.0): a live-infrastructure/runtime-state claim tagged `[STATIC-INFERENCE]` cannot exceed P1, and a P0 that one cheap read-only command could falsify (with no agent having run it) is capped at P1 until verified.**
0.5d. Coverage check — flag unexamined risk categories, scan source for gaps
1-3. Debate quality, disagreement rulings, consensus correctness. **A `[STATIC-INFERENCE-CONSENSUS]` point — multiple reviewers agreeing off the same artifact lines — counts as one source, not independent verification.**
4-5. Absent-safeguard check, independent gap scan, score assessment
6-7. Epistemic label classification (including `[LIVE-VERIFIED]` / `[STATIC-INFERENCE]` / `[STATIC-INFERENCE-CONSENSUS]` for live-state claims), final verdict
8-9. Action items, meta-observation
10. **Write ruling to `{state_dir}/phase_14_judge_ruling.md`** (v3.1.0+).

See `references/prompt-templates.md` for the full judge prompt.

---

## Phase 14.5: Post-Judge Verification Gate (v3.2.0)

The Supreme Judge in Phase 14 can introduce **new** P0/P1 findings as a
side effect of its Step-0 Verification Review — findings the panel never
raised. Phase 11 (Severity Verification) only re-verifies panel-raised
P0/P1, so judge-introduced findings bypass every prior verification phase.
A 2026-04-27 README review run produced a hallucinated "12 unresolved git
conflict markers" P0 (the file was clean — `wc -l` and `grep -c` both
confirmed) and that single fabricated finding drove a 3/10 REJECT-AND-
REWRITE verdict (issue [#41](https://github.com/wan-huiyan/agent-review-panel/issues/41)).

Phase 14.5 closes this gap by re-verifying every judge-introduced P0/P1
against ground truth before Phase 15.1 generates the report.

A single Opus agent runs after Phase 14 and before Phase 15.1. Inputs are
the paths to `{state_dir}/phase_14_judge_ruling.md`,
`{state_dir}/phase_11_severity_verification.md`, and
`{state_dir}/phase_8_audit.md`. The agent has grep / Read / Bash tools.

**Budget mode (v3.7.0):** no agent is spawned. The orchestrator itself diffs
the judge's P0/P1 list against the union of reviewer + consolidated-verifier
P0/P1s, runs 1–2 direct grep/Read probes on any `[JUDGE-INTRODUCED]` finding,
and demotes unverifiable ones to `[JUDGE-UNVERIFIED]` open questions. The
protection is preserved; the agent spin-up is not.

Steps:
1. Classify each P0/P1 finding in the judge ruling as `[PANEL-RAISED]`
   (skip — covered by Phase 11) or `[JUDGE-INTRODUCED]` (verify here).
2. For every `[JUDGE-INTRODUCED]` finding, run a ground-truth check
   appropriate to the claim type (location, state, existence, external
   domain) using grep/Read/git/Bash. Quote actual command output.
3. Issue a verdict per finding: `[JUDGE-CONFIRMED]` (passes through),
   `[JUDGE-HALLUCINATED]` (demote to P3 or remove if actively
   contradicted), or `[JUDGE-PARTIAL]` (demote one level, edit to retain
   only the replicated sub-claim).
4. If any P0 was demoted/removed, recompute the verdict score against
   the panel mean and document the override.
5. Write the full verification table to
   `{state_dir}/phase_14_5_judge_verification.md`. Phase 15.1 reads it.

**Phase 15.1 banner.** When the gate produces any `[JUDGE-HALLUCINATED]`
entry, Phase 15.1 MUST emit this block immediately after the
Executive Summary (and after the Compressed Run banner if present):

```markdown
> ⚠️ **Judge Verification:** N judge-introduced finding(s) flagged as
> [JUDGE-HALLUCINATED] in Phase 14.5. Verdict score replaced with panel
> mean (X/10 → Y/10). Affected action items below carry the
> [JUDGE-HALLUCINATED] suffix.
```

Affected action items keep the `[JUDGE-HALLUCINATED]` epistemic-label
suffix in both the markdown report and the HTML dashboard expandable
issue card metadata.

**Empty case.** If the gate produces zero `[JUDGE-INTRODUCED]` findings
(every P0/P1 was already panel-raised), it writes a stub file with the
single line "No judge-introduced findings to verify" so Phase 15.1's
disk-read still succeeds.

See `references/prompt-templates.md` for the full Judge-Output
Verification Agent prompt.

---

## Phase 15: Output Generation

Three output files are written at the end of every review. They are produced
in strict sequence: Phase 15.1 first, then Phase 15.2, then Phase 15.3.
Phase 15.3 runs AFTER Phase 15.2 (not in parallel) so that the Phase 15.3
agent can read the already-written Phase 15.1 and 15.2 files from disk,
avoiding the need for the orchestrator to inject all structured data and
process history into the agent prompt from its own context window.

---

### Phase 15.1: Primary Markdown Report

Write structured summary to `review_panel_report.md` (or user-specified name).
This is the main deliverable — concise, structured, action-oriented.

**Compressed-run warning (v3.1.0+):** If the Phase 13.5 verification gate
detected any unrecoverable missing phase output, Phase 15.1 MUST emit this
block as the FIRST content of the report (before any other section,
including Executive Summary):

```markdown
> ⚠️ **COMPRESSED RUN — Phases skipped: <comma-separated list, e.g., "4 (security), 5 (security, devils-advocate)">**
>
> This run did not complete the full panel protocol. The Supreme Judge ruled
> on partial input. Findings below should be treated as **lower confidence**
> than a full-run report. Re-run the panel for a complete review.
```

Additionally, in compressed runs, every action item MUST have `[COMPRESSED]`
appended to its epistemic label (e.g., `[CONSENSUS][COMPRESSED]`,
`[VERIFIED][COMPRESSED]`).

For full runs, the warning block is absent. Its absence is the green-light
signal that the panel completed the full protocol.

**No-debate warning (v3.5.0) — the load-bearing debate-skip chokepoint.**
Phase 15.1 is the terminal step every completed run passes through, so the
NO-DEBATE detection is anchored HERE (not only in the Phase 13.5 gate, which
an inline/workflow-shaped run can skip — that is precisely how the audit's
silent skips slipped past). **Before writing the report, the orchestrator
MUST independently check whether any `reviewer_*_phase_5_round1.md` state
files exist** (under `state/`, or any `state/run_<N>/` in multi-run mode) —
**and, in the same pass, whether any `reviewer_*_BLOCKED.md` exists there.** Any
BLOCKED file forces the COMPRESSED RUN block above (BLOCKED's second anchor: an
inline/workflow-shaped run never reaches the Phase 13.5 gate that reads it). If
**no `reviewer_*_phase_5_round1.md` exists** — the adversarial debate (Phase 5)
did not run for this panel — Phase 15.1 MUST emit this block as report content
(immediately AFTER the COMPRESSED RUN block if one is present, otherwise FIRST,
before the Executive Summary):

```markdown
> ⚠️ **[NO-DEBATE] — adversarial debate (Phase 5) did not run.**
>
> Reviewers evaluated independently but never cross-examined each other's
> findings. The Supreme Judge reconciled disagreements alone, without a debate
> record. Treat consensus and disagreement rulings as **lower confidence** —
> no reviewer had the chance to revise a verdict in light of a peer's. For a
> high-stakes or adversarial-tradeoff decision, re-run the **full** panel with
> debate (invoke as a skill, not a workflow), or use the debate-in-Workflow
> recipe.
```

In a no-debate run:
- Every action item MUST have `[NO-DEBATE]` appended to its epistemic label
  (e.g., `[CONSENSUS][NO-DEBATE]`, `[SINGLE-SOURCE][NO-DEBATE]`).
- The `**Confidence:**` header field MUST be capped at **Medium** (if the
  judge ruled High, lower it one level to Medium and note why); a no-debate
  run can never report High confidence.
- The "Debate Rounds + Summaries" collapsible in Detailed Reviews renders the
  placeholder "No debate rounds — Phase 5 did not run for this panel."

**Chokepoint limit — a Workflow run reaches Phase 15.1 only if its script
authors a report stage.** Phase 15.1 is terminal for *orchestrator-driven*
runs: the orchestrator walks the phase list, so every such run passes through
it. A Workflow / ultracode run has no orchestrator walking that list — its
stages are whatever the script author wrote. A script that ends at `Judge`
never executes Phase 15.1, so neither the NO-DEBATE check nor the COMPRESSED
check ever fires, no matter how much the run skipped. This is a real hole in
the chokepoint, and it cannot be closed by detection from inside the skill.
The mitigation is authorial: the **Debate-in-Workflow recipe** below requires a
terminal `Report` stage that IS Phase 15.1, and requires the COMPRESSED RUN
banner inside it. A Workflow that returns findings without a Phase 15.1 report
stage has not run this panel, and its output MUST NOT be presented as a panel
report.

**Banner stacking & the COMPRESSED overlap.** COMPRESSED (per-file loss) and
NO-DEBATE (wholesale Phase-5 absence) are distinct signals and **stack**: when
both apply, render NO-DEBATE first (it is the more specific, higher-severity
signal for the verdict), then COMPRESSED. NO-DEBATE is the named signal for
zero Phase-5 output, so a COMPRESSED block need not also enumerate "5" in its
phases-skipped list when the NO-DEBATE banner is present. For full runs where
debate ran, the NO-DEBATE block is absent; its absence is the green-light
signal that adversarial debate occurred.

**Budget-mode banner (v3.7.0).** When the run used budget mode, Phase 15.1
MUST additionally render the `[BUDGET-MODE]` banner defined in the Budget
Mode section. Stacking order when several apply: `[NO-DEBATE]` first, then
`COMPRESSED RUN`, then `[BUDGET-MODE]`. A budget run that completed its
single debate round gets ONLY the `[BUDGET-MODE]` banner.

```markdown
# Review Panel Report
**Work reviewed:** {title/path}  |  **Date:** {today}
**Panel:** {N} reviewers + Auditor + Judge
**Verdict:** {recommendation}  |  **Confidence:** {High|Medium|Low}
**Auto-detected signals:** {list or "None — base set used"}
**Review mode:** {Precise|Exhaustive|Mixed} (auto-detected from content type)
**Data flow trace:** {Standard|Thorough|Exhaustive} tier | {N} paths traced | {M} invariant violations (v2.14)
{If skipped: "**Data flow trace:** Skipped ({reason — pure docs / no transforms / plan-only})"}
**Codebase state:** {branch name} | {N commits behind {default_branch}} | {worktree: yes/no}
{If multi-run: "**Runs:** {N} (personas rotated per schedule)"}
{If multi-run: "**Run stability:** {X}% of findings appeared in 2+ runs | {Y} single-run findings"}
{If stale: "⚠️ STALE BRANCH — {N} commits merged to {default_branch} since branch point. Findings about missing code should be verified against {default_branch}."}

## Executive Summary
{Judge's verdict, 3-5 sentences. Score X/10.}
{If score spread < 2: Correlation Notice about shared model biases}
{If Low confidence: "⚠️ HUMAN REVIEW RECOMMENDED"}

## Scope & Limitations
{What was reviewed. What CANNOT be evaluated: runtime behavior, production
data, security via dynamic analysis. Structural limitation: shared base model.}
Epistemic labels: [VERIFIED] [CONSENSUS] [SINGLE-SOURCE] [UNVERIFIED] [DISPUTED] [WEB-VERIFIED] [WEB-CONTRADICTED] [WEB-INCONCLUSIVE] [JUDGE-HALLUCINATED] [LIVE-VERIFIED] [STATIC-INFERENCE] [STATIC-INFERENCE-CONSENSUS]
Defect type labels: [EXISTING_DEFECT] (bug in current code) [PLAN_RISK] (risk if plan is implemented as written)

## Score Summary
| Reviewer | Persona | Intensity | Initial | Final | Recommendation |

## Consensus Points
{Bullet list of points all/most reviewers agreed on, confirmed by judge}

## Disagreement Points (with judge rulings)
{Each disagreement: Side A, Side B, Verification Round result if run, Judge's ruling with reasoning}

## Completeness Audit Findings
{New issues found by auditor, verified by judge}

## Coverage Gaps (if any)
{Risk categories no reviewer examined, with judge's independent assessment}

{If multi-run: "## Run Comparison"}
{If multi-run: Table showing which findings appeared in which runs, with stability labels}

## Action Items (with severity AND epistemic labels{, and stability labels if multi-run})

## Detailed Reviews (collapsible sections)
- Data Flow Map (Phase 2, v2.14) — if tracer ran
- Round 0: Independent Reviews
- Private Reflections
- Debate Rounds + Summaries
- Final Blind Assessments
- Completeness Audit
- Verification Command Execution Results
- Claim Verification Report
- Severity Verification Table
- Verification Tier Assignment (4.8)
- Targeted Verification Results (4.9)
- Supreme Judge Full Analysis
```

---

### Phase 15.2: Full Agent Process History

Write `review_panel_process.md` — the "director's cut". This is a complete,
chronological, verbatim log of every agent's output with nothing summarized away.
The orchestrator assembles this from accumulated outputs; no new agent needed.

**Persona profiles are embedded** at the point each agent first enters the flow:
before each agent's output, a structured "Persona Profile" block documents that
agent's role, expertise, reasoning strategy, agreement intensity (for panelists),
matched-claim-type (for Phase 13 agents), and which phases they participated in.
This makes the process history fully self-explanatory to a reader who wasn't present.

Structure (in order, verbatim for each):

```
Persona Profiles Registry (at top)
  - All panelist profiles listed before any review output
  - Phase 12b tier advisor profile
  - Phase 13 verification agent profiles (added as they are assigned)
  - Supreme judge profile

Phase 1: Setup
  - Context Brief (full)
  - Persona selection rationale
  - Review mode detection

Phase 3: Independent Reviews
  - [Persona Profile — Persona A] full profile block
  - [Persona A] Full review text
  - [Persona Profile — Persona B] full profile block
  - [Persona B] Full review text
  - ... (all N)

Phase 4: Private Reflections
  - [Persona A] Full reflection + per-finding confidence ratings
  - [Persona B] Full reflection
  - ... (all N)

Phase 5: Debate Rounds
  - Round 1: All reviewer responses (verbatim)
  - Phase 6 Summary: Resolved / Still in dispute / New discoveries
  - Round 2: All reviewer responses (if run)
  - Phase 6 Summary: ...
  - Round 3: ... (if run)

Phase 7: Blind Final Assessments
  - [Persona A] Final score, top 3 points, recommendation, verdict
  - [Persona B] ...
  - ... (all N, unsealed)

Phase 8: Completeness Audit
  - Full auditor output

Phase 9: Verification Command Execution
  - Each command run, raw output, annotation

Phase 10: Claim Verification
  - Full verification table + flagged claims

Phase 11: Severity Verification
  - Full severity verification table + reasoning per finding

Phase 12: Verification Tier Assignment
  - Phase 12a: Confidence-based draft table (with signals)
  - [Persona Profile — Tier Refinement Advisor] profile block
  - Phase 12b: Tier refinement advisor full output (overrides + reasoning)

Phase 13: Targeted Verification Agents
  - [Persona Profile — Verification Agent: Point #1] full profile block
    (role, matched-claim-type, why matched, tier, VoltAgent subagent or generic)
  - [Point #1 — Tier — Persona] Full investigation trail, what was searched,
    what was found, full reasoning, verdict
  - [Persona Profile — Verification Agent: Point #2] ...
  - [Point #2 ...] (all N verification agents, verbatim)

Phase 14: Supreme Judge Deliberation
  - [Persona Profile — Supreme Judge] profile block
  - Full judge output (all steps, unabridged)
```

See `references/prompt-templates.md` for the Phase 15.2 assembly spec.

---

### Phase 15.3: Interactive HTML Report

Launch a single Opus agent to write `review_panel_report.html` — a polished,
self-contained single-file interactive dashboard with **expandable issue
cards** (v2.15).

**CRITICAL — Data passing strategy (v2.16.4 context-pressure fix):** Do NOT
inject the structured data or process history into the agent prompt from the
orchestrator's context. Instead, the agent prompt MUST instruct the agent to
read from disk:
1. Read `review_panel_report.md` (already written by Phase 15.1) for all
   structured summary data (verdict, scores, action items, consensus, etc.)
2. Read `review_panel_process.md` (already written by Phase 15.2) for
   verbatim reviewer narratives, debate transcripts, judge rulings, and
   verification agent trails — extracting per-finding content for the
   10-section accordion
3. Read `references/prompt-templates.md` starting from the line
   `## Phase 15.3: HTML Report Generation Prompt` for the full rendering
   spec (HTML structure, CSS, JS, expandable card schema, filter logic,
   Prism.js setup, print styles)

**Path resolution (CRITICAL):** The orchestrator MUST resolve all paths to
absolute paths before including them in the Phase 15.3 agent prompt. The
subagent has no knowledge of the skill installation directory or the user's
output directory. Substitute:
- `{output_dir}` → the actual resolved output directory (where Phase 15.1
  wrote `review_panel_report.md`)
- `{skill_dir}` → the absolute path to the skill's `references/` directory
- If the user specified a custom output name (e.g., `--output my_review.md`),
  use the actual filenames, not the defaults

The orchestrator's Phase 15.3 launch prompt should be SHORT (~10 lines):
```
You are the Phase 15.3 HTML Report Agent. Generate `{output_dir}/{html_filename}`
by reading these files:
1. {output_dir}/{report_filename} — structured review data
2. {output_dir}/{process_filename} — verbatim narratives and transcripts
3. {skill_dir}/references/prompt-templates.md (search for "Phase 15.3: HTML
   Report Generation Prompt") — the authoritative rendering spec
Follow the rendering spec exactly. Write the complete HTML file.
```

This keeps the orchestrator's launch prompt under 200 tokens instead of
700+ lines, eliminating the context-pressure failure mode.

**Features:**
- Dashboard overview: verdict, score, panel composition at a glance
- Stats row: issue counts by severity (P0–P3), tier (Light/Standard/Deep),
  verdict (VR_CONFIRMED/VR_REFUTED/VR_PARTIAL/VR_INCONCLUSIVE/VR_NEW_FINDING)
- Charts: confidence distribution, tier breakdown (donut), verdict breakdown
  (horizontal bar), pipeline flow (issues entering/surviving each verification phase)
- **Panel Gallery**: collapsible section with avatar cards for every agent —
  panelists (role, agreement intensity, reasoning strategy, phase badges), Phase
  13 verification specialists (matched claim type, why matched, tier, "verified
  N items" count), and support agents (auditor, judge, tier advisor). Clicking a
  panelist card filters the issue list to items they raised.
- **Expandable issue cards (v2.15)**: each card is a native `<details>` element.
  The collapsed state shows the one-line summary; the expanded state reveals a
  10-section accordion (each section is its own nested `<details>`):
  1. 📖 **Narrative** — full reviewer reasoning (verbatim, not summarized)
  2. 📄 **Code Evidence** — file:line snippets with Prism.js syntax highlighting
  3. 👥 **Raised by** — per-reviewer severity + reasoning grid
  4. 🔍 **Verification Trail** — full VR agent output (if verified)
  5. 💬 **Debate** — round-by-round transcript (if disputed)
  6. ⚖️ **Judge Ruling** — full reasoning + severity-change explanation
  7. 🛠️ **Fix Recommendation** — proposed change + before/after code + regression test + blast radius + effort
  8. 🔗 **Cross-references** — related findings with relationship labels
  9. 🏷️ **Epistemic Tags** — hover tooltips explaining each label
  10. 📊 **Prior Runs** — meta-review comparison (if multi-run)

  Empty sections render "No {section} data" placeholders — all 10 sections
  always present for consistent card structure.
- **Deep-link support**: `report.html#issue-A1` auto-opens that card and scrolls
- **Keyboard navigation**: ↑/↓ between cards, Enter expands, Home/End jump to first/last, `/` focuses search
- **Expand all / Collapse all** controls at the top of the Issues tab
- **Print-friendly**: `@media print` forces all details open, inverts theme, hides charts
- Filter bar: filter by severity, tier, verdict, epistemic label simultaneously
- Sort controls: by severity, confidence, tier
- Inline CSS/JS; Tailwind CSS, Chart.js, and **Prism.js** (v2.15, new) loaded via CDN

**Chart.js wrapper-div mandate (v3.2.0).** Every Chart.js `<canvas>` MUST
be wrapped in a `<div style="position: relative; height: 220px; width: 100%;">`
(or equivalent class) with explicit pixel height. The bare `<canvas height>`
attribute is a no-op when `responsive: true` and the dashboard always uses
`maintainAspectRatio: false` — without a height-bounded parent, the canvas
grows on every layout pass, producing infinite vertical growth on open,
scroll, resize, or interaction. See issue
[#42](https://github.com/wan-huiyan/agent-review-panel/issues/42) for the
2026-04-27 reproduction. The Phase 15.3 prompt enforces this; the test
suite asserts every `<canvas>` has a position-relative height-bounded
parent.

See `references/prompt-templates.md` for the Phase 15.3 agent prompt with the
full 10-section schema and rendering spec.

**Compressed-run banner (v3.1.0+):** If the source Phase 15.1 markdown
report begins with the `⚠️ COMPRESSED RUN` blockquote, Phase 15.3 MUST render
a prominent red banner at the top of the HTML body containing the same
warning text. Suggested CSS:

```html
<div role="alert" style="background:#FEE2E2; color:#991B1B; padding:1rem 1.25rem; margin:1rem 0; border:2px solid #DC2626; border-radius:6px;">
  <strong>⚠️ COMPRESSED RUN — Phases skipped: <list></strong>
  <p>This run did not complete the full panel protocol. ... Re-run the panel for a complete review.</p>
</div>
```

The banner appears above the report header summary card.

**No-debate banner (v3.5.0):** If the source Phase 15.1 markdown report
contains the `⚠️ [NO-DEBATE]` blockquote, Phase 15.3 MUST render a prominent
amber banner at the top of the HTML body with the same warning text. Use a
distinct amber/orange palette so it reads as separate from the red COMPRESSED
banner; when both are present, render NO-DEBATE first, then COMPRESSED.
Suggested CSS:

```html
<div role="alert" style="background:#FEF3C7; color:#92400E; padding:1rem 1.25rem; margin:1rem 0; border:2px solid #D97706; border-radius:6px;">
  <strong>⚠️ [NO-DEBATE] — adversarial debate (Phase 5) did not run.</strong>
  <p>Reviewers evaluated independently but never cross-examined each other. The judge reconciled disagreements without a debate record — treat rulings as lower confidence. Re-run the full panel with debate for high-stakes decisions.</p>
</div>
```

The banner appears above the report header summary card (and above the
COMPRESSED banner if both are present).

---

### Phase 15 Verification Gate (MANDATORY — v2.16.4)

Before reporting completion, verify ALL THREE output files exist by checking
that each file was successfully written (e.g., `ls -la review_panel_report.md
review_panel_process.md review_panel_report.html`).

**If all three files exist:** proceed to the completion message below.

**If `review_panel_report.html` is missing (Phase 15.3 failed):**
1. Log: "Phase 15.3 HTML report generation failed. Retrying..."
2. Retry Phase 15.3 ONCE with the same disk-reading prompt (the agent reads
   from disk, so no orchestrator context re-assembly is needed)
3. After retry, verify again
4. If the file now exists: proceed to completion message
5. If still missing after retry: report the two files that DO exist, and
   tell the user: "The HTML report could not be generated automatically.
   To generate it manually, say: **generate the HTML review report**"

**Completion message (only after verification passes):**
Tell user:
- Paths to all output files that were successfully written
- Verdict + score (from primary report)
- Counts: consensus points, disagreements, action items, verification verdicts
- Top P0 action item (if any)
- Note: HTML report requires internet connection for Tailwind CSS, Chart.js, and Prism.js CDNs
- HTML footer should read "Agent Review Panel v3.9.1" (MUST match the full semver from `plugin.json` — update this line whenever the version is bumped)

---

### Manual HTML Report Recovery (v2.16.4)

If the user asks to "generate the HTML report" or "generate the HTML review
report" after a review has completed (whether Phase 15.3 failed or the user
wants to regenerate), launch the Phase 15.3 agent with the same disk-reading
prompt described above. Resolve all paths to absolute paths. The agent MUST:
1. Read the Phase 15.1 output file (e.g., `review_panel_report.md`) for
   structured data — use the actual filename from the completed review
2. Read the Phase 15.2 output file (e.g., `review_panel_process.md`) for
   verbatim content
3. Read the skill's `references/prompt-templates.md` (absolute path) starting
   from "Phase 15.3: HTML Report Generation Prompt" for the rendering spec

Do NOT write a generic styled HTML page from the orchestrator's memory of the
review. The spec in `references/prompt-templates.md` is authoritative — it
specifies Tailwind CSS, Chart.js, Prism.js, the 10-section expandable accordion,
Panel Gallery, filter logic, keyboard navigation, deep-linking, and print styles.
Any HTML report that does not follow this spec is non-compliant.

---

## Review-Mode Spectrum & Debate-in-Workflow (v3.5.0)

This skill is the **full adversarial panel** — its distinguishing feature is
Phase 5–7 **debate** (reviewers cross-examine each other before a judge rules).
Debate is expensive (sequential cross-talk) and only pays off when reviewers
would genuinely change each other's verdicts. A 2026-06-06 audit of 51 real
runs found debate ran in only 1 — most reviews were (correctly or not) routed
to debate-less fast modes. Pick the mode deliberately:

| Want | Use | Debate? |
|---|---|---|
| Fast eyes on a tiny PR | `code-review` / `single-agent-multi-persona-review` | no |
| Independent parallel lenses, small PR, autonomous multi-PR run | `parallel-panel-streamlined-no-debate` | no (by design) |
| **Adversarial tradeoff, high-stakes gating, debate would change the verdict** (security vs perf, "is this P0 real", merge go/no-go) | **this skill (full panel) — invoke as a skill, NOT a workflow** | **yes (Phase 5–7)** |
| Adversarial coverage on a cost leash (routine-but-nontrivial changes, cost-sensitive or autonomous runs) | **this skill, budget mode** ("budget review") | yes (1 round) |

**Why "invoke as a skill, not a workflow" matters.** Debate lives in this
skill's Agent-tool orchestration. The Workflow / ultracode engine is a
*parallel fan-out* engine (`parallel()` / `pipeline()` — agents never see each
other) whose canonical recipe is literally "find → verify → judge". Running
"review this in ultracode" therefore produces a structurally debate-less run,
and the panel's NO-DEBATE banner will fire. If you *want* the panel's depth
under a Workflow, you must author debate as an explicit phase.

### Debate-in-Workflow recipe (ultracode-mode)

Debate IS achievable inside a Workflow — it just isn't the default shape. The
trick: a debate "round" is just re-spawning each reviewer agent **with its
peers' prior-round findings injected** (it reads peer state files). Sequential
cross-talk becomes a pipeline where stage N reads stage N−1's siblings.

**This recipe is a compressed run and MUST declare itself one.** It reproduces
Phases 1, 3, 5, 8, 10, 11, 14 and 15.1 and skips everything else. Authoring a
`Debate` phase makes the round-1 state files exist, which satisfies the
NO-DEBATE check **and nothing else** — it buys nothing toward completeness,
citation, or severity verification. A Workflow that authors `Debate` and stops
there passes the debate detector while skipping every verification pass. That
is exactly the silently-degraded run this skill forbids (same principle as
Budget Mode: degraded rigor is chosen and loudly bannered, never silently
applied). So the recipe has **five mandatory stages, not three**, plus a
mandatory banner. Dropping stage 3 or stage 5 makes the run non-compliant.

**Why stage 3 is not optional (measured, 2026-08-10).** A panel run authored
from the earlier three-stage form of this recipe shipped two wrong findings: a
reviewer cited a changelog entry to the wrong Claude Code version (Phase 10
verifies citations against source), and a reviewer filed a P0 that a single
read-only probe falsified (Phase 11 re-reads ground truth for every P0 and
downgrades overstated ones). Both were caught by hand afterwards, not by the
protocol. Stage 3 reuses budget mode's **consolidated verifier** (Phases 8 +
10 + 11 in one agent, spec'd in Budget Mode below) — one `agent()` call.

```js
// 1. Round 1 — independent reviews, in parallel (no cross-talk yet).
const round1 = await parallel(PERSONAS.map(p => () =>
  agent(`Review the work as ${p.name}. Write findings to state/reviewer_${p.key}_phase_5_round1.md`,
        {phase: 'Review', schema: FINDINGS_SCHEMA})));

// 2. Debate round 2 — each reviewer re-runs WITH every peer's round-1 findings
//    as input, and rebuts/revises. This is the cross-examination.
const round2 = await parallel(PERSONAS.map((p, i) => () =>
  agent(`You are ${p.name}. Your round-1 findings: ${JSON.stringify(round1[i])}.
         Your peers' round-1 findings: ${JSON.stringify(round1.filter((_,j)=>j!==i))}.
         Where do you concede, push back, or find a NEW issue their angle exposes?
         Write to state/reviewer_${p.key}_phase_5_round2.md`,
        {phase: 'Debate', schema: REBUTTAL_SCHEMA})));

// 3. MANDATORY — consolidated verification (Phases 8 + 10 + 11 in one agent).
//    Omitting this stage is the silent degradation this recipe exists to prevent.
const verified = await agent(`Consolidated verifier per Budget Mode. Read the round-1 and
  round-2 state files, then: completeness sweep for risks no reviewer examined; check every
  P0/P1 citation against the cited source (file, line, version, changelog entry) and label
  what does not check out; re-read ground truth for every P0/P1 and downgrade any severity
  the source does not support. Write state/phase_8_10_11_verification.md`,
  {phase: 'Verify', schema: VERIFICATION_SCHEMA});

// 4. Judge reconciles WITH the debate record AND the verifier (not alone).
const ruling = await agent(`Adjudicate. Read the round-1, round-2 and
  phase_8_10_11_verification state files; rule on each disagreement citing how the debate
  moved (or didn't). Do NOT restore a severity the verifier downgraded, and do NOT accept a
  finding whose citation the verifier could not confirm.`,
  {phase: 'Judge', schema: RULING_SCHEMA});

// 5. MANDATORY — report stage. This stage IS Phase 15.1: it applies the Phase 15.1
//    banner rules, including the COMPRESSED RUN block below. A Workflow with no report
//    stage never reaches the Phase 15.1 chokepoint, so no banner check ever fires.
const report = await agent(`Write review_panel_report.md per the skill's Phase 15.1 spec,
  opening with the mandatory COMPRESSED RUN banner for debate-in-Workflow runs and
  appending [COMPRESSED] to every action item's epistemic label.`, {phase: 'Report'});
```

**Mandatory banner.** Every run authored from this recipe MUST open its report
with this block. The phases-skipped list is fixed because the recipe's shape is
fixed — it is not recomputed per run:

```markdown
> ⚠️ **COMPRESSED RUN — Phases skipped: 2 (data flow trace), 4 (private reflection), 6 (round summarization), 7 (blind final), 9 (verification commands), 12 (tier assignment), 13 (targeted verification), 13.5 (pre-judge gate), 14.5 (post-judge gate), 15.2/15.3 (process + HTML reports)**
>
> This run executed as a Workflow (ultracode) via the debate-in-Workflow recipe:
> debate and consolidated verification ran, the phases above did not. Findings
> are **lower confidence** than a full-run report. Re-run the panel as a skill
> for the complete protocol.
```

Per Phase 15.1, every action item in such a report also carries `[COMPRESSED]`
on its epistemic label. A Workflow that skips the `Debate` phase gets the
`[NO-DEBATE]` banner as well (stacked first).

---

## Orchestrator Efficiency Discipline (v3.8.0 — all modes)

**Default for every mode — full panel, deep, multi-run, assessment, and
budget alike.** A 2026-07-16 token audit of a real full-protocol run found
**69% of total cost in the orchestrator main loop** (157 turns, each
re-reading a context that grew 270k → 630k tokens) — not in the reviewer
fan-out (7%). None of the rules below removes a review, debate round, or
verification pass; they cut pure orchestration overhead, so they apply
always, not just under a budget constraint.

1. **Batch launches** — one message with multiple Agent calls (or multiple
   SendMessage calls) per wave. Never launch wave members one turn at a time.
2. **Persistent reviewers** — spawn each persona ONCE in Phase 3; drive
   Phases 4, 5 (every round), and 7 via SendMessage to the same agent. Its
   context is cached; a fresh spawn re-reads the work at full price.
   Fallback: if SendMessage fails or is unavailable, fresh-spawn the persona
   with instructions to read its own prior `state/` files from disk.
   **Nested-context caveat (measured 2026-07-16):** when the orchestrator is
   itself a subagent, reviewers' SendMessage *replies* may not route back and
   wave-completion notifications may not arrive. The state files on disk are
   the reliable signal: after dispatching a wave, do NOT end the turn to
   "wait" — poll the state directory for the expected files (sleep loop),
   verify, and proceed.

   **Addressing persistent reviewers (v3.9.0).** `SendMessage` has resolved a
   subagent by its `agentId` since Claude Code 2.1.77; panel reviewers are
   spawned without a name, so that is the only address that works.

   - **Capture it.** Every Phase 3 spawn result carries an `agentId` (foreground
     and background spawns alike). Record a **persona → agentId map** before
     leaving Phase 3, **per-run in multi-run mode**. Keep it in orchestrator
     context — do NOT write a state file for it; nothing would read it.
   - **Use only it.** Address every Phase 4 / 5 / 7 send by that raw `agentId`.
     Never the persona label, never the `description` string passed to the Agent
     tool — neither resolves, and a send to one returns
     `{"success": false, "message": "No agent named '<X>' is reachable..."}`.
     Addressing by `agentId` also avoids the name-reuse misrouting fixed in
     2.1.199, which Run 3 is exposed to because it spawns three Devil's
     Advocates at once.
   - **Check the result.** Since 2.1.224 a failed delivery returns
     `{"success": false, ...}` instead of reporting success. Treat it as a
     failed agent under the existing retry-once rule in Implementation Notes —
     but that rule's retry here is a **fresh spawn, not a second send**: the
     agent is unreachable, so re-sending cannot work, and dropping to
     "minimum 2 reviewers" is not the fallback either. Fresh-spawn the persona
     in the same turn. Never assume a send landed.
   - **Applies to budget mode too** — its Phase 5 and Phase 7 drive the same
     persistent reviewers.
3. **≤50-word agent returns** — every subagent returns a state-file path +
   a ≤50-word summary, never verbatim content (tightened from 100 words in
   v3.8.0).
4. **No inter-phase narration** — at most one line per phase transition
   ("Phase 5 round 1 done — 2 disputes remain"). No restating findings, no
   progress essays; findings live in state files and the final report.
5. **Turn budget** — target **≤40 orchestrator turns** for a full panel
   (measured pre-discipline run: 157). Budget mode tightens this to ≤25.
   Exceeding the target is not a failure, but each turn past it should be
   doing orchestrator-only work no agent could do.
6. **Fresh-session recommendation** — if the current conversation already
   carries substantial prior context at panel start, say so before Phase 1:
   in the measured run the panel *started* at a 270k-token baseline, so all
   157 turns re-paid that baseline as cache reads — a fresh session cuts the
   per-turn tax ~4× . Offer to proceed anyway.
7. **Read state files only for orchestrator logic** — the orchestrator opens
   a state file only where a phase requires orchestrator-side work on it
   (Phase 6 round summarization, Phase 12a dispute detection, the Phase 14
   judge ruling, Phase 14.5/15.1 checks). It never re-reads files that the
   next agent can read from disk itself.

## Budget Mode (v3.7.0)

**Explicit opt-in only — never auto-selected.** Two ways in:

1. **Named trigger**: "budget review", "budget mode", "budget panel", "cheap
   review", "economy review", "low-cost panel", "affordable review",
   "token-efficient review", "frugal review", "lite panel", or `budget`
   passed to `/agent-review-panel`.
2. **Cost constraint attached to a panel request** (v3.7.1): any otherwise-full
   panel request that carries an explicit cost/token concern — "keep the cost
   down", "without burning tokens", "don't spend too much", "watch the token
   spend", "cheaply". The user stating a cost constraint IS the opt-in;
   confirm in one line ("Running in budget mode — say 'full panel' to
   override") and proceed. A bare panel request with no cost language never
   selects budget mode.

Budget mode is opt-in rather than default because its savings are not free:
sonnet reviewers surface fewer subtle findings than opus, one debate round
replaces adaptive multi-round convergence, and one consolidated verifier
replaces three dedicated verification passes — the redundancy that has caught
real defects (including judge-fabricated P0s). Degraded rigor must be chosen
and loudly bannered, never silently applied — the same principle behind
`[NO-DEBATE]`.

**Why it exists (measured, not guessed).** A 2026-07-16 token audit of a real
full-protocol panel run (2026-07-02, production repo, all phases + debate)
cost **$162**, split:

| Cost driver | Share | Root cause |
|---|---|---|
| Orchestrator main loop | **$111 (69%)** | 157 orchestrator turns, each re-reading a context that grew 270k → 630k tokens (58.7M cumulative cache-read) |
| Judge ran twice + P14.5 verifier agent | $18 (11%) | Duplicate judge passes + a full agent for the post-judge gate |
| HTML report (P15.3) + driving it | ~$7 (4%) + main-loop share | 75k output tokens + orchestrator round-trips |
| 4 reviewers, Phases 3–7 | ~$12 (7%) | The fan-out everyone assumes dominates — it doesn't |
| 4 separate verification agents (P8/10/11 + ad-hoc) | ~$11 (7%) | One agent spin-up per verification concern |

Budget mode targets the drivers in measured order. Target cost: **~20–25% of
a full run** with the adversarial core (debate + independent judge) intact.

### What changes

| Phase | Full panel | Budget mode |
|---|---|---|
| 1 Setup | Up to 6 personas + signal specialists | **Exactly 3 reviewers**: 2 content-matched personas + Devil's Advocate. No signal-specialist additions. `model: "sonnet"` explicit. |
| 2 Data Flow Trace | Standard/Thorough/Exhaustive | **Skipped by default** (header notes "Data flow trace: Skipped (budget mode)"). Run only if the user asks. |
| 3+4 Review + Reflection | Two separate waves | **One wave** — each reviewer produces the independent review AND the self-reflection/confidence section in a single run, written to `state/reviewer_<name>_phase_3.md`. |
| 5–6 Debate | 1–3 adaptive rounds + round summaries | **Exactly 1 round** (`reviewer_<name>_phase_5_round1.md` — so the NO-DEBATE check passes honestly). Orchestrator writes a ≤10-line round summary itself; no summarizer agent. |
| 7 Blind Final | Separate wave | Same persistent reviewer agents, one SendMessage each. |
| 8, 10, 11 Verification | 3 separate opus agents | **ONE consolidated verifier** (`model: "sonnet"`): completeness sweep + citation check on all P0/P1 (sample P2+) + severity re-read of every P0/P1. Writes `state/phase_8_10_11_verification.md`. |
| 9 Verify Commands | Up to 5 commands | Unchanged (orchestrator bash — cheap, high value). |
| 12 Tier Assignment | 12a + 12b advisor agent | **12a only** (orchestrator logic). No 12b agent. |
| 13 Targeted Verification | Persona-matched agents per dispute | **Skipped.** Unresolved disputes go to the judge labeled `[UNVERIFIED]`. |
| 13.5 Pre-Judge Gate | Orchestrator checks | Unchanged (it is orchestrator logic, and it is the debate-presence chokepoint). |
| 14 Supreme Judge | Opus judge (never downgrade) | Unchanged — **`model: "opus"`, exactly one pass**. No advisory second judge. |
| 14.5 Post-Judge Gate | Dedicated verifier agent | **Orchestrator check, no agent**: diff the judge's P0/P1 list against the union of reviewer + verifier P0/P1s. Any judge-introduced defect gets 1–2 direct grep/Read probes; unverifiable ones are demoted to `[JUDGE-UNVERIFIED]` open questions instead of accepted findings. |
| 15 Output | 15.1 md + 15.2 process + 15.3 HTML | **15.1 markdown only.** Offer 15.2/15.3 as a follow-up (their agents read state files from disk, so generating them later loses nothing). |

### What does NOT change

- **Debate runs.** One real cross-examination round — budget mode is not a
  no-debate mode, and a budget run must never trip the `[NO-DEBATE]` banner
  unless the round genuinely failed (then both banners apply; NO-DEBATE first).
- **The judge is opus, domain-neutral, and singular.** Judgment quality is the
  product; the judge is never downgraded to sonnet.
- **Judge-hallucination protection stays** (in the cheaper orchestrator form
  above — the v2.16/PR-#38 lesson that judges can fabricate P0s still applies).
- Live-State Claim Discipline, Context Gathering, Review Mode Detection, the
  Phase 13.5 and Phase 15 verification gates: all unchanged.
- **The explicit-model rule stays.** Budget mode never omits `model:` — it
  passes `model: "sonnet"` (reviewers, verifier) or `model: "opus"` (judge)
  explicitly. The v2.14 anti-fallthrough rule was about *silent* defaults.

### Orchestrator turn diet (targets the measured 69%)

Since v3.8.0 the turn diet is NOT budget-specific — the full **Orchestrator
Efficiency Discipline** (batched launches, persistent reviewers via
SendMessage, ≤50-word returns, no inter-phase narration, fresh-session
recommendation) applies to every mode. Budget mode tightens two knobs:

1. **Turn budget ≤25** (vs ≤40 for a full panel; measured pre-discipline
   run: 157) — achievable because budget mode also merges Phases 3+4 and
   consolidates verification.
2. **Strictest read rule** — the orchestrator reads NO state file except the
   judge ruling and the consolidated verifier summary (the full-panel rule
   additionally permits Phase 6 summarization and Phase 12a dispute
   detection, which budget mode does more cheaply: its single debate round
   summary is written by the orchestrator itself, ≤10 lines).

### `[BUDGET-MODE]` banner (Phase 15.1)

Every budget-mode report MUST open with this block (ordering when stacked:
`[NO-DEBATE]` first if present, then `COMPRESSED RUN`, then `[BUDGET-MODE]`):

```markdown
> 💸 **[BUDGET-MODE] — reduced-cost protocol.**
>
> This panel ran budget mode: 3 reviewers (sonnet), a single debate round,
> one consolidated verification pass, one opus judge pass, markdown-only
> output. Coverage is real but narrower than a full panel — fewer personas,
> no targeted verification agents, no data-flow trace. For a high-stakes or
> adversarial-tradeoff decision, re-run the full panel.
```

Confidence rule: the report's `**Confidence:**` field may be **High only if
the consolidated verification pass confirmed every P0/P1 finding**; otherwise
cap it at Medium and say why. (If NO-DEBATE also applies, its Medium cap wins
regardless.)

### Incompatibilities

- **Multi-run (`--runs N > 1`)**: refuse the combination — multi-run is a
  maximum-coverage tool, budget mode is a minimum-cost tool. Ask the user to
  pick one; if unreachable (autonomous run), run budget single-run and note
  the downgrade in the report header.
- **Deep research mode**: if both are requested, budget wins — skip web
  research and note "Deep research: skipped (budget mode)" in the header.
- **Assessment mode (v3.6.0)**: incompatible — the control-validation gate
  and generated persona set require the full protocol. Run assessment mode
  at full cost or don't run it.

### State files (budget mode)

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── reviewer_<name>_phase_3.md         # review + reflection (merged 3+4)
│   ├── reviewer_<name>_phase_5_round1.md  # the single debate round
│   ├── reviewer_<name>_phase_7.md         # blind final
│   ├── phase_8_10_11_verification.md      # consolidated verifier
│   └── phase_14_judge_ruling.md
└── review_panel_report.md                 # Phase 15.1 (only output)
```

---

## Multi-Run Union Protocol (v2.14)

A single panel run catches ~60–70% of discoverable issues. Independent runs
with rotated persona compositions have only ~30% finding overlap — meaning
each run catches issues the others miss. For high-stakes reviews, the
Multi-Run Union Protocol runs the panel N times and merges results.

### Invocation

- **Flag:** `--runs N` (explicit count)
- **Natural language:** "run 3 times and merge", "multi-run review",
  "run twice with different reviewers", "maximum coverage review"
- **Default:** N=1 (no merge, single-run mode)
- **"Multi-run" without N:** defaults to 2

### Persona Rotation Schedule

Deterministic given the run number. Run 1 uses the base set; subsequent
runs use complementary sets to maximize coverage diversity.

| Run # | Persona Set | Purpose |
|-------|------------|---------|
| 1 | Standard content-type base set + signal specialists | Canonical review |
| 2 | Complementary: Code Quality Auditor, Performance Specialist, Methodology Analyst, DA + DIFFERENT signal specialists than Run 1 | Catch what Run 1 missed |
| 3 | Adversarial-heavy: 3 Devil's Advocates (different reasoning strategies) + 1 Correctness Hawk | Stress-test consensus |
| 4+ | Cycle through 1–3 with shuffled signal specialists | Diminishing returns |

**Run 3 Devil's Advocates** use different reasoning strategies:
1. Analogical reasoning ("compare to known failure patterns from similar projects")
2. Adversarial simulation ("imagine you are an attacker / malicious user")
3. Failure mode enumeration ("list every way this could fail in production")

### Key Rules for Multi-Run Mode

1. **Content classification runs ONCE** (in Run 1). The classification is
   FIXED for all subsequent runs. This eliminates the primary source of
   cross-run non-determinism documented in the consistency analysis.
2. **Phase 2 (Data Flow Trace) runs ONCE** (in Run 1). The Data Flow Map is
   cached and shared with all subsequent runs. The trace is deterministic
   for a given codebase; re-running would not produce different paths.
3. **Each run independently executes Phases 3–15** with its own persona set.
4. **Per-run reports** are written to `review_panel_report_run{N}.md`.
5. **After all runs complete**, Phase 16 (Merge) runs once to produce the
   final merged `review_panel_report.md`.
6. **Runs MAY execute in parallel** if the orchestrator supports it (launching
   multiple run orchestrations as parallel background agents). Sequential
   execution is also acceptable.

---

## Phase 16: Merge (v2.14, multi-run only)

Single agent (`model: "opus"`). VoltAgent mapping:
`voltagent-meta:knowledge-synthesizer` (always pass `model: "opus"`).

The Merge Agent receives all N per-run reports and executes:

1. **Collect all findings** from all runs, preserving severity, location,
   bug class, epistemic label, and source run number.

2. **Deduplicate by semantic similarity.** Two findings are duplicates if AND
   ONLY IF:
   - Same location (same file AND same function, OR lines within 10 of each other)
   - AND same bug class
   - Different bug classes at same location → keep both
   - Same bug class at different locations → keep both
   - When in doubt, prefer keeping duplicates over false merging

3. **Score stability.** For each merged finding, count how many runs produced it:
   - `[N/N RUNS]` — found in every run, highest confidence
   - `[K/N RUNS]` (1 < K < N) — found in multiple runs, medium-high confidence
   - `[1/N RUNS]` — single-run finding, NOT demoted. Single-run findings
     often represent unique persona insights that only one configuration
     surfaced. The consistency analysis proved single-run P0s are often the
     most valuable findings.

4. **Resolve severity disagreements.** When runs disagree on severity for a
   merged finding, use the HIGHEST severity from any run (conservative:
   false negatives are invisible while false positives are visible and
   dismissible). Note the range: "P0 (Run 1) / P1 (Run 2)".

5. **Resolve judge divergence.** If per-run judges gave scores more than 2
   points apart, flag `[JUDGE_DIVERGENCE]`, explain what drove the difference
   (different persona focus? different threat model?), and provide an
   independent merged assessment.

6. **Produce the merged report** at `review_panel_report.md`. Per-run reports
   remain at `review_panel_report_run{N}.md` for audit trail.

### Merged Report Additions

The single-run Phase 15.1 report format is extended with:

**New header fields:**
```
**Runs:** {N} (personas rotated per schedule)
**Run stability:** {X}% of findings appeared in 2+ runs
**Unique to single run:** {Y} findings
```

**New required section:**
```
## Run Comparison
| Finding | Run 1 | Run 2 | Run 3 | Merged Severity | Stability |
```

**New label type in Scope & Limitations:**
```
Stability labels: [N/N RUNS] (high confidence) [K/N RUNS] (medium) [1/N RUNS] (single-angle)
```

**Action items gain a stability label:**
```
1. **[P0] [VERIFIED] [2/2 RUNS]** Add mutex lock around token refresh
2. **[P1] [CONSENSUS] [1/2 RUNS]** Sanitize error messages *(Run 2 only: Security Auditor)*
```

See `references/prompt-templates.md` for the full Phase 16 Merge Agent prompt.

---

## Implementation Notes

### State files (v3.1.0+)

Subagent outputs for Phases 3, 4, 5, 7, 8, 10, 11, and 14 are written to disk
under a `state/` subdirectory of the review output directory, then the
subagent returns only the file path plus a ≤50-word summary. The orchestrator
reads files on demand rather than holding verbatim subagent outputs in its
context window.

Reviewer state files use the naming convention
`state/reviewer_<name>_phase_<N>.md` (where `<name>` is the persona slug and
`<N>` is the phase number); orchestrator-level state files include
`state/phase_8_audit.md`, `state/phase_10_claim_verification.md`,
`state/phase_11_severity_verification.md`, `state/phase_14_judge_ruling.md`, and `state/phase_14_5_judge_verification.md` (v3.2.0).

**Single-run layout:**

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── reviewer_<name>_phase_3.md         # independent review
│   ├── reviewer_<name>_phase_4.md         # private reflection
│   ├── reviewer_<name>_phase_5_round1.md  # debate response
│   ├── reviewer_<name>_phase_7.md         # blind final assessment
│   ├── phase_8_audit.md
│   ├── phase_10_claim_verification.md
│   ├── phase_11_severity_verification.md
│   ├── phase_14_judge_ruling.md
│   └── phase_14_5_judge_verification.md      # v3.2.0 — post-judge gate
├── review_panel_report.md                  # Phase 15.1
├── review_panel_process.md                 # Phase 15.2
└── review_panel_report.html                # Phase 15.3
```

**Multi-run layout (Phase 16):**

```
docs/reviews/<date>-<topic>/
├── state/
│   ├── run_1/reviewer_<name>_phase_3.md
│   ├── run_1/reviewer_<name>_phase_4.md
│   ├── ...
│   ├── run_2/reviewer_<name>_phase_3.md
│   └── ...
```

Each run's state lives under `state/run_<N>/` (e.g.
`state/run_1/reviewer_<name>_phase_3.md`,
`state/run_2/reviewer_<name>_phase_3.md`). The merge step (Phase 16) reads
state files from each run independently when computing union findings.

This pattern mirrors `overnight-insight-discovery`, `successor-handoff`, and
`cloud-run-results-bq-postsync` — every long-running multi-agent skill in the
local catalog routes intermediate outputs through disk to keep the
orchestrator window small.

- **Parallel execution:** Phases 3, 4, 5, 7 use single message with multiple
  Agent tool calls. Phases 2, 8, 9, 10, 11, 12, 13, 14 are sequential (Phase 9 is
  orchestrator-driven via Bash, not a subagent). Phase 12a is orchestrator
  logic (no agent). Phase 12b is a single Opus agent. Phase 13 agents launch
  in parallel (single message with one Agent call per dispute point). Phases
  15.1, 15.2, and 15.3 run in strict sequence (15.1 → 15.2 → 15.3). Phase
  15.3 runs AFTER 15.2 so its agent can read the already-written files from
  disk instead of requiring the orchestrator to inject all data in-context.
- **Context management:** Full content in Phases 2, 3, 8, 14. Phase 6 summaries
  with source excerpts in debate rounds for long works (>500 lines).
- **Error handling:** Retry failed agents once — including a `SendMessage` that
  returns `success: false`, which is a failed agent, not a delivered message.
  Proceed with minimum 2 reviewers.
  Note gaps in report. Phase 15.3 has an explicit verification gate (v2.16.4):
  if the HTML file is missing after the agent returns, retry once before
  degrading to 2-file output with a manual recovery instruction for the user.
- **Idempotent:** Safe to re-run on the same content — each invocation produces
  an independent panel with no side effects from previous runs.
- **Auto-persona algorithm:** Classify → base set → signal scan → add up to 6 →
  replace DA first. See `references/signals-and-checklists.md` for signal table.
- **Multi-run execution (v2.14):** When `--runs N > 1`, Phase 1 runs once
  (shared classification + signal detection + context brief), Phase 2 runs
  once in Run 1 (cached Data Flow Map), then Phases 3–15 repeat N times
  with rotated personas, then Phase 16 merges. Runs MAY execute in parallel
  (independent orchestrations) or sequentially.
- **Orchestrator efficiency (v3.8.0):** the Orchestrator Efficiency
  Discipline (batched launches, persistent reviewers via SendMessage with
  fresh-spawn fallback, ≤50-word agent returns, no inter-phase narration,
  ≤40-turn full-panel target, fresh-session recommendation) is the default
  for ALL modes. It cuts the measured 69% orchestrator-main-loop cost driver
  without removing any review, debate, or verification work.
- **Explicit model, always (v2.14, amended v3.7.0):** ALWAYS pass `model:`
  explicitly when launching agents, even with `subagent_type`. VoltAgent
  agents may have sonnet/haiku defaults in their frontmatter; without
  explicit override, reviewer reasoning depth varies across runs — an
  invisible source of cross-run variance in v2.9–v2.13. Full panel passes
  `model: "opus"` everywhere; budget mode passes `model: "sonnet"` for
  reviewers/verifier and `model: "opus"` for the judge. The rule is about
  never letting the model be chosen *silently*, not about opus per se.

## Edge Cases

- **No content provided:** Ask user what to review. Do not launch a panel with empty input.
- **Budget mode + multi-run requested together (v3.7.0):** Refuse the combination and ask the user to pick one; if the user is unreachable, run budget single-run and note the downgrade in the report header.
- **Budget mode debate round fails (v3.7.0):** If the single Phase 5 round produces zero `reviewer_*_phase_5_round1.md` files after one retry, the NO-DEBATE machinery applies as usual — both banners render (NO-DEBATE first) and the Medium confidence cap wins.
- **Very large files (>500 lines):** Use Phase 6 summaries with excerpts instead of full content in debate rounds. Cap at 20k lines total.
- **Binary/image files:** Skip. Note in report: "Binary files excluded from review."
- **Single tiny file (<20 lines):** Reduce to 2 reviewers (minimum). Full panel is overkill.
- **No P0/P1 findings:** Skip Phases 9 and 11. Proceed directly to claim verification.
- **No unresolved disputes or unverified action items:** Skip Phases 12 and 13. Proceed directly to Phase 14.
- **All reviewers agree (score spread < 2):** Flag correlated-bias warning in report. Do NOT skip debate — unanimous agreement is the most dangerous failure mode.
- **Phase 2 skipped (v2.14):** For pure docs/plans, or code with no data transforms (pure API routing, static config), skip Phase 2 entirely. Note reason in Context Brief and report header: "Data flow trace: Skipped ({reason})". Proceed directly to Phase 3.
- **Single-run mode (v2.14):** `--runs 1` (default) skips Phase 16 (Merge). Report is written directly to `review_panel_report.md` by Phase 15.1. No stability labels. No Run Comparison section.
- **Multi-run with N > 3 (v2.14):** Persona rotation cycles through Runs 1/2/3 schedule with shuffled signal specialists. N > 4 has diminishing returns — warn the user that marginal finding discovery drops sharply after Run 3.
- **Multi-run judge divergence (v2.14):** If per-run judge scores span > 2 points, Phase 16 flags `[JUDGE_DIVERGENCE]` and provides an independent merged assessment rather than averaging.
- **Exhaustive trace on very large codebases (v2.14):** No token budget limit. If the file is > 20k lines, Phase 2 may take > 30 min. Warn the user and offer Thorough tier as alternative.
- **HTML report soft size cap (v2.15):** Target 150–250KB, soft cap 500KB. If the combined structured data (all 10 expandable sections across all findings) exceeds 500KB, the Phase 15.3 agent SHOULD offer a "slim" mode that drops verbatim `fullEvidence` and `debateTranscript` content (replacing with summaries). Slim mode is indicated in the report header and footer.
- **Prism.js CDN unreachable (v2.15):** If the Prism.js CDN fails to load, code evidence blocks render as unstyled `<pre><code>` elements (still readable, just without syntax colors). Wrap Prism calls in `try/catch` to prevent a CDN failure from breaking the page. This is consistent with the existing graceful-degradation approach for Tailwind and Chart.js CDN failures.
- **Empty expandable sections (v2.15):** When a finding lacks data for any of the 10 accordion sections (e.g., no debate, no prior runs), render a "No {section} data" placeholder instead of omitting the section. Every expanded card must show all 10 sections in the same order for consistent structure. This prevents the v2.13 nice-shtern compliance gap where agents silently omitted the expand button when evidence fields were empty.
- **Reviewer cannot see the work under review (v3.9.0):** usual cause is a reviewer subagent provisioned without `Bash`, so it cannot run `gh pr diff` or `git checkout`. Handling is specified once, under **Blocked reviewers** in Phase 3.

For full prompt templates, see `references/prompt-templates.md`.
For version history, see `references/changelog.md`.
