# Test Coverage Analysis

**Date:** 2026-03-30
**Scope:** Full repository (`wan-huiyan/agent-review-panel`)
**Version analyzed:** v2.8.0 / v2.9.0 (eval-suite)

---

## Current State

The repository has **zero automated tests** and **no test framework**. The only testing artifact is `eval-suite.json`, which contains:

| Category | Count | Purpose |
|----------|-------|---------|
| Positive triggers | 18 | Prompts that SHOULD activate the skill |
| Negative triggers | 14 | Prompts that should NOT activate the skill |
| Edge-case triggers | 10 | Ambiguous prompts with expected behavior |
| v2.9 triggers | 7 | VoltAgent-specific trigger tests |
| Test cases (behavioral) | 10 | Prompts with regex assertions on output |
| Edge-case scenarios | 11 | Boundary conditions with assertions |

**Problem:** `eval-suite.json` defines test cases but has no runner. The assertions (regex patterns) are never executed. This is a specification without a harness.

---

## Gap Analysis

### 1. Trigger Classification (HIGH priority)

**What exists:** 49 trigger examples in `eval-suite.json` with `should_trigger: true/false`.
**What's missing:** An automated test that feeds each prompt to the skill's trigger logic and verifies the classification.

**Proposed tests:**
- Parameterized test over all `triggers[]` entries: assert `should_trigger` matches actual classification
- Boundary tests for the "multiple independent perspectives" heuristic
- Regression tests for known false positives (neg-7: "address the PR comments", neg-8: "review this essay")
- Regression tests for known false negatives (edge-1: "review this thoroughly")

### 2. Behavioral Assertions (HIGH priority)

**What exists:** 10 `test_cases[]` and 11 `edge_cases[]` with regex assertions on expected output patterns.
**What's missing:** A runner that executes the skill against each prompt and validates the assertions.

**Proposed tests:**
- For each `test_cases[]` entry: run the skill, capture output, validate all `assertions[]`
- For each `edge_cases[]` entry: validate `expected_behavior` matches actual behavior
- Output format validation: verify the report contains all required sections (Executive Summary, Score Summary, Consensus Points, etc.)

### 3. Persona Selection Logic (MEDIUM priority)

**What exists:** SKILL.md documents 4 content-type persona sets (code, plan, mixed, docs) with specific personas and agreement intensities.
**What's missing:** No tests verify the persona selection algorithm.

**Proposed tests:**
- Pure code input → Correctness Hawk, Architecture Critic, Security Auditor, Devil's Advocate
- Pure plan input → Feasibility Analyst, Stakeholder Advocate, Risk Assessor, Devil's Advocate
- Mixed input → Feasibility Analyst, Code Quality Auditor, Risk Assessor, Devil's Advocate
- Documentation input → Clarity Editor, Technical Accuracy Reviewer, Completeness Checker, Devil's Advocate
- **Critical rule:** Mixed content with ANY code/SQL/config MUST include Code Quality Auditor
- Agreement intensity values match spec (e.g., Devil's Advocate always 20%)

### 4. Content Signal Detection (MEDIUM priority)

**What exists:** `references/signals-and-checklists.md` defines 10 signal groups with keyword lists and a 3-keyword threshold.
**What's missing:** No tests verify signal detection fires correctly.

**Proposed tests per signal group:**
- SQL/Data: 3+ of {SELECT, FROM, JOIN, CREATE TABLE, ...} → adds Data Quality Auditor
- Auth/Security: 3+ of {auth, token, JWT, OAuth, ...} → adds Security Auditor
- Infrastructure: 3+ of {Dockerfile, kubernetes, terraform, ...} → adds Reliability/SRE Reviewer
- ML/Statistics: 3+ of {model, training, accuracy, ...} → adds Statistical Rigor Reviewer
- ...and 6 more signal groups
- **Boundary test:** exactly 2 keywords → signal should NOT fire
- **Boundary test:** exactly 3 keywords → signal SHOULD fire
- **Cap test:** auto-add stops at 6 total personas
- **Replacement test:** Devil's Advocate is replaced first when at cap

### 5. Review Mode Detection (MEDIUM priority)

**What exists:** SKILL.md defines mode auto-detection rules (Precise/Exhaustive/Mixed).
**What's missing:** No tests verify the mode is correctly assigned based on content type.

**Proposed tests:**
- Pure code → Precise mode (findings require line numbers)
- Pure plan → Exhaustive mode (broader risk identification allowed)
- Mixed content → Mixed mode (Precise for code, Exhaustive for prose)
- Documentation → Exhaustive mode
- Verify Precise mode demotes findings without line citations to [UNVERIFIED]

### 6. Report Structure Validation (MEDIUM priority)

**What exists:** SKILL.md defines a mandatory report template with specific sections.
**What's missing:** No tests verify generated reports contain all required sections.

**Proposed tests:**
- Report contains header fields: Work reviewed, Date, Panel, Verdict, Confidence, Review mode
- Report contains all required sections: Executive Summary, Scope & Limitations, Score Summary, Consensus Points, Disagreement Points, Completeness Audit Findings, Action Items, Detailed Reviews
- Score spread < 2 triggers Correlation Notice
- Low confidence triggers "HUMAN REVIEW RECOMMENDED" warning
- Epistemic labels are present: [VERIFIED], [CONSENSUS], [SINGLE-SOURCE], [UNVERIFIED], [DISPUTED]

### 7. Edge Case Handling (LOW-MEDIUM priority)

**What exists:** SKILL.md documents 6 edge cases. `eval-suite.json` has 11 `edge_cases[]`.
**What's missing:** No automated validation.

**Proposed tests:**
- No content provided → asks for clarification (does not launch panel)
- Very large files (>500 lines) → uses summaries with excerpts in debate rounds
- Single tiny file (<20 lines) → reduces to 2 reviewers
- No P0/P1 findings → skips Phases 4.55 and 4.7
- All reviewers agree (spread < 2) → flags correlated-bias warning, does NOT skip debate
- Custom reviewer count request (ec-3) → accommodates the request

### 8. Phase Flow Integrity (LOW-MEDIUM priority)

**What exists:** SKILL.md defines a 6-phase pipeline with sub-phases.
**What's missing:** No tests verify phase ordering and data flow.

**Proposed tests:**
- Phases execute in correct order: 1 → 2 → 2.5 → 3 → 3.5 → 4 → 4.5 → 4.55 → 4.6 → 4.7 → 5 → 6
- Phase 2 reviewers run in parallel (single message with multiple Agent calls)
- Phase 3.5 summarization happens between debate rounds
- Convergence check terminates debate when all disputes are minor
- Maximum 3 debate rounds regardless of convergence
- Sycophancy detection fires when >50% position changes lack new evidence

### 9. Context Gathering (LOW priority)

**What exists:** 7-step context gathering process documented in SKILL.md.
**What's missing:** No tests verify context gathering completeness.

**Proposed tests:**
- Sibling directory scan finds README, CLAUDE.md, config files
- Reference tracing identifies imports and cross-file references
- Safety mechanism discovery greps for known patterns (_valid, _flag, etc.)
- Temporal scope verification checks all instances in date range
- Knowledge mining follows L0 → L1 → L2 tiering
- Web research triggers only in deep mode or for 5+ uncovered signal keywords
- Context brief contains all required sections

### 10. VoltAgent Integration (LOW priority, v2.9-specific)

**What exists:** 7 v2.9 trigger tests and 3 v2.9 test cases in `eval-suite.json`.
**What's missing:** No automated validation of VoltAgent persona mapping.

**Proposed tests:**
- VoltAgent available → uses specialist agents for matching personas
- VoltAgent not installed → graceful fallback to generic personas with install suggestion
- Partial VoltAgent install → uses available specialists, suggests missing ones
- Multi-signal mapping (Go + PostgreSQL + microservices → correct specialist agents)
- Devil's Advocate stays generic even when VoltAgent is requested

### 11. Plugin/Manifest Consistency (LOW priority)

**What exists:** `plugin.json`, `marketplace.json`, root `SKILL.md`, `skills/agent-review-panel/SKILL.md`.
**What's missing:** No tests verify consistency between these files.

**Proposed tests:**
- Version in `plugin.json` matches `marketplace.json` matches `eval-suite.json`
- Plugin name is consistent across all manifests
- `skills` paths in `marketplace.json` resolve to actual directories
- Root SKILL.md and skills/agent-review-panel/SKILL.md are identical or intentionally different

---

## Recommended Implementation Plan

### Phase 1: Build the eval harness (highest ROI)

Create a lightweight Node.js or Python test runner that:
1. Loads `eval-suite.json`
2. Runs trigger classification tests (items 1 above) — these can be tested without invoking the full skill by pattern-matching against the trigger description in SKILL.md
3. Validates manifest consistency (item 11)

**Why first:** These are deterministic, fast, and catch regressions in trigger logic.

### Phase 2: Output format validation

Add tests that validate generated report structure (item 6):
1. Parse a sample report against the expected template
2. Check for required sections, labels, and fields
3. Can run against saved report fixtures without invoking the skill live

### Phase 3: Integration tests (behavioral)

Build integration tests that invoke the skill end-to-end:
1. Run test_cases from eval-suite.json with regex assertions
2. Run edge_cases with expected behavior validation
3. These are expensive (require Claude API calls) — run on CI nightly, not per-commit

### Phase 4: Snapshot/golden-file tests

Capture golden outputs for known inputs and detect regressions:
1. Save baseline reports for representative inputs
2. Compare structural diff (sections present, persona count, phase count) — not exact text match

---

## Priority Matrix

| Area | Priority | Effort | Current Coverage |
|------|----------|--------|-----------------|
| Trigger classification | HIGH | Low | 0% (specs exist, no runner) |
| Behavioral assertions | HIGH | Medium | 0% (specs exist, no runner) |
| Persona selection | MEDIUM | Medium | 0% |
| Signal detection | MEDIUM | Medium | 0% |
| Review mode detection | MEDIUM | Low | 0% |
| Report structure | MEDIUM | Low | 0% |
| Edge case handling | LOW-MEDIUM | Medium | 0% |
| Phase flow integrity | LOW-MEDIUM | High | 0% |
| Context gathering | LOW | High | 0% |
| VoltAgent integration | LOW | Medium | 0% |
| Manifest consistency | LOW | Low | 0% |
