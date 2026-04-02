# Changelog

All notable changes to Agent Review Panel.

## [2.10.0] — 2026-03-30

### Added
- **Codebase State Check (Phase 1, Step 3c)** — Detects worktree/branch divergence before review begins. Prevents the panel from flagging code as "missing" when it exists on main but not in the reviewed branch. Motivated by a real engagement where 4 reviewers + completeness auditor unanimously flagged a class as "non-existent" — but it existed on `main` (merged via a PR after the worktree branched).

## [2.9.0] — 2026-03-28

### Added
- **VoltAgent Integration** — Maps panel personas to 127+ VoltAgent specialist agents across 10 families (qa-sec, data-ai, infra, lang, domains, etc.) for deeper domain-specific reviews. Falls back to generic persona-prompted agents when VoltAgent isn't installed.
- Full mapping table for core personas, signal-detected specialists, and orchestration phases.
- Installation suggestion (once per session) when beneficial VoltAgent agents are missing.

## [2.8.0] — 2026-03-25

### Added
- **Review Mode Detection** — Auto-detects review mode from content type: Precise (code — requires line citations), Exhaustive (plans/docs), or Mixed. In Precise mode, findings without code citations cannot exceed P2.
- **Phase 4.55: Verification Command Execution** — Runs up to 5 read-only verification commands (grep/cat/head/tail/wc only) from P0/P1 findings. Annotates findings with [CMD_CONFIRMED], [CMD_CONTRADICTED] (demotes 1 level), [CMD_INCONCLUSIVE], or [CMD_FAILED]. Advisory, not gating.

## [2.7.0] — 2026-03-22

### Added
- **Phase 4.7: Severity Verification** — Dedicated agent reads the actual codebase to verify every P0 and P1 finding before the judge sees them. Classifies each as [EXISTING_DEFECT] or [PLAN_RISK]. P0 severity requires [EXISTING_DEFECT]; a [PLAN_RISK] is at most P1. Motivated by v2.6 benchmark where 2/3 P0 findings were overstated after code investigation.

## [2.6.0] — 2026-03-18

### Changed
- **References directory** — Domain checklists, prompt templates, and changelog extracted to `references/` files. SKILL.md reduced from 1,331 to 340 lines (75% token reduction) while preserving all review methodology.
- **Explicit negative scope** — "When NOT to Use" section prevents false triggers on single code reviews, bug fixes, deployment tasks, and skill improvement requests.
- **Structured domain checklists** — Specialist reviewers use explicit checklist format producing systematic assessments.

### Validated
- A/B tested against v2.5 on a 1,132-line ML pipeline plan. Both reached identical verdict (4/10, "Needs Significant Revision") with the same core findings. v2.6 showed marginal improvements in checklist discipline and judge output structure.

## [2.5.0] — 2026-03-15

### Added
- **Phase 4.6: Claim Verification** — Dedicated agent verifies every reviewer line-number citation against actual source. Classifies as [VERIFIED], [INACCURATE], [MISATTRIBUTED], [HALLUCINATED], or [UNVERIFIABLE].
- **Epistemic labels** — Judge classifies every finding with confidence tags.
- **Scope & Limitations section** — Every report states what the panel cannot evaluate.
- **Correlated-bias disclaimer** — Flags when all reviewers converge (score spread < 2 points).

## [2.4.0] — 2026-03-12

### Added
- **Skill/Docs Portability signal group** — Auto-detects when reviewing skills or documentation claiming cross-platform applicability. Adds Portability Auditor with 7-item checklist. 9 signal groups total.

## [2.3.0] — 2026-03-08

### Added
- **Knowledge mining** — Mines feedback memories, project/global lessons, and skill insights before launching reviewers.
- **Built-in domain checklists** — 8 signal groups with pre-built review checklists.
- **Deep research mode** — Opt-in web research for domain best practices.
- 2 new signal groups: Cost/Billing and Data Pipeline/ETL (total: 8).

## [2.2.0] — 2026-03-05

### Added
- **Context gathering (Phase 1)** — Auto-scans sibling directories, traces imports/references, discovers existing safety mechanisms.
- **Reviewer suggestion qualifier** — Reviewers must state what safeguard would need to be absent.
- **Absent-safeguard check** — Judge verifies [CRITICAL] recommendations against existing safeguards.
- **Diverse reasoning strategies (DMAD)** — Each persona uses a different reasoning approach.
- **Anti-rhetoric guard** — Judge checks whether position changes were driven by evidence or eloquence.

## [2.1.0] — 2026-03-01

### Added
- **Auto-persona from content signals** — Keyword detection adds domain-specific reviewers up to 6 total.
- **Source-grounded debate** — Phase 3.5 summaries include inline code snippets for disputed points.

## [2.0.0] — 2026-02-25

### Added
- **Completeness Auditor** — Post-debate agent re-reads source line-by-line.
- **"New Discovery" requirement** — Each debate round requires agents to find at least one new issue.
- **Hybrid persona selection** — Mixed content always includes Code Quality Auditor.

### Fixed
- Discovery vs. argumentation problem from v1 — debate rounds no longer cause agents to stop finding new issues.

## [1.0.0] — 2026-02-15

### Added
- Initial release: multi-agent adversarial review with independent review, debate, and judge phases.
