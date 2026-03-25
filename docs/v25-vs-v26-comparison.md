# v2.5 vs v2.6 A/B Test Results

**Test date:** 2026-03-25
**Document reviewed:** Barry University enrollment propensity model enhancement plan (1,132 lines, mixed content with SQL + Python)
**Methodology:** Full 6-reviewer panel run on the same document using v2.5 (inline, 1,331-line SKILL.md) then v2.6 (references/, 340-line SKILL.md)

---

## Score Comparison

| Reviewer | v2.5 | v2.6 | Delta |
|----------|------|------|-------|
| Feasibility Analyst (60%) | 7/10 | 6/10 | -1 |
| Code Quality Auditor (40%) | 5/10 | 4/10 | -1 |
| Risk Assessor (30%) | 6/10 | 4/10 | -2 |
| Devil's Advocate (20%) | 3/10 | 4/10 | +1 |
| Data Quality Auditor (35%) | 5/10 | 4/10 | -1 |
| Pipeline Safety Reviewer (35%) | 6/10 | 4/10 | -2 |
| **Supreme Judge** | **4/10** | **4/10** | **0** |

Both runs reached the same verdict: **"Needs Significant Revision"**

---

## Findings Overlap

### Core findings (present in both runs)
- 5-file parity without shared module (6/6 both runs)
- Bundling fixes with features (5/6 both runs)
- DF status code unhandled (5/6 both runs)
- Production write not idempotent (4/6 both runs)
- Sentinel 999 anti-pattern (4/6 both runs)

### v2.6 improvements
- **COALESCE bf vs af skew elevated to P0** — v2.6 had 3 reviewers explicitly call this a "P0 bug"; v2.5 noted it but didn't prioritize as strongly
- **IC reclassification caught** — v2.6 noticed IC moved from Other/Rare without justification
- **NS structural handling questioned** — v2.6 explicitly asked to see the code
- **alien_status contradiction** — caught by 4/6 in v2.6 vs 2/6 in v2.5
- **Explicit checklist format** — Data Quality and Pipeline Safety reviewers used structured checklists from `references/signals-and-checklists.md`

### v2.5 had slight edge in
- Devil's Advocate creativity (Knight Capital analogy, ethical concerns on distance feature)
- Feasibility Analyst nuance (deeper backward reasoning on ND code semantics)

---

## Structural Differences

| Aspect | v2.5 | v2.6 |
|--------|------|------|
| SKILL.md loaded | 1,331 lines / 62KB | 340 lines / 15KB |
| References used | N/A | signals-and-checklists.md, prompt-templates.md |
| Domain checklists | Ad-hoc | Explicit format from references/ |
| Judge output | Narrative | Priority-tiered (P0/P1/P2) with effort estimates |
| Action items | 12 | 14 (more granular) |

---

## Conclusion

The v2.6 schliff improvements (references/ extraction, negative scope, composability metadata) **did not degrade review quality** and showed marginal improvements in checklist discipline and judge structure. The references/ architecture provides structured domain knowledge to specialist reviewers, resulting in slightly more systematic assessments.

**Schliff score improvement was validated as real:** 75.1 → 85.6 composite with no loss in output quality.
