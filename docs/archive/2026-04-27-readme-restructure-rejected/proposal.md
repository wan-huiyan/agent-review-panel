# README Restructure Proposal — Eliminate Quick Start / Installation Duplication

**Author:** Claude (suggested), pending @wan-huiyan approval
**Date:** 2026-04-27
**Files affected:** README.md only
**Risk:** Low (docs-only)
**Reviewable artifact:** This proposal doc + the current `README.md` in this repo

## Problem statement

The current README has two large adjacent sections — **Quick Start** (lines 21–93) and **Installation** (lines 135–273) — that significantly duplicate each other. A reader hitting "Installation" after reading "Quick Start" sees the same install commands re-listed under "Claude Code marketplace (recommended) → Shell / CLI equivalent," along with re-explanations of what the commands do, the shell-vs-REPL distinction, and the `@<marketplace-name>` format callout. Net effect: the installation story is told ~1.7× and the README is roughly 50 lines longer than necessary.

## Concrete duplication audit

Items appearing in BOTH Quick Start and Installation:

| Content | Quick Start location | Installation location |
|---|---|---|
| `claude plugin marketplace add wan-huiyan/agent-review-panel` + `claude plugin install roundtable@agent-review-panel` shell block | line 39 (Path B) | line 165 (Shell / CLI equivalent) |
| Same commands in REPL form (`/plugin marketplace add ...`, `/plugin install ...`) | lines 47–49 (collapsible) | not in Installation but the rationale is reiterated |
| Explanation of "what the install does" | "The `roundtable` plugin bundles two skills..." (line 91) | "Claude Code downloads the plugin to its cache..." (line 170) |
| `@<marketplace-name>` format callout (which name is which) | implicit in Path A prompt + Path B intro | explicit callout block (line 172) |
| "Why the marketplace path?" reasoning | implicit | explicit block (line 174) |

Items unique to **Installation** (worth keeping):
- Surface compatibility table (✅ CLI / VS Code / Desktop Code tab vs. ❌ web chat / raw API). Lines 137–155. **High value, can't go in Quick Start without bloating it.**
- Updating to latest version. Lines 174–232.
- Manual clone (development / custom setup). Lines 234–246.
- Cursor experimental. Lines 252–273.
- Claude Code version requirement. Line 248.

## Proposed restructure

**Quick Start** stays mostly intact — it owns the install story:
- Path A (Claude-Code-assisted, recommended for upgrades)
- Path B (terminal commands)
- REPL form (collapsible)
- Upgrade-from-v2.x cleanup (collapsible)
- Bundle note
- Use example
- Example report (collapsible)

**Installation** is reduced to a "details and alternatives" section that references back instead of repeating:

```markdown
## Installation

> Install commands are in [Quick Start](#quick-start) above (Path A or B).
> This section covers compatibility, updates, manual clone, and the Cursor adapter.

### Requires Claude Code
[surface compatibility table — UNCHANGED]

### Updating to the latest version
[update commands — UNCHANGED]

### Manual clone (development / custom setup)
[manual clone — UNCHANGED]

### Cursor (experimental)
[Cursor adapter — UNCHANGED]
```

**Removed from Installation** (because they're now exclusively in Quick Start):
- "### Claude Code marketplace (recommended)" subsection (~30 lines) — its install commands and explanations all duplicate Quick Start
- The `@<marketplace-name>` format callout block — Quick Start's Path A/B already implicitly cover this; if explicit clarification is needed, it can be a one-liner under Quick Start
- "Why the marketplace path?" paragraph — already implicit in Quick Start framing

## Anticipated objections

1. **"Someone scrolling to the Installation section won't find the install commands."** Mitigated by the prominent pointer block at the top of Installation linking back to Quick Start. Readers landing in the middle (e.g. via TOC click) get one extra scroll/click to reach the commands, in exchange for everyone else seeing a less repetitive document.

2. **"The Installation section is shorter / less impressive."** True. But "shorter" reads as "more confident" once you have the surface-compatibility table and update flow — those are the genuinely useful parts that the install repetition was burying.

3. **"Search engines / GitHub search may rank the install commands lower."** Possible — Quick Start retains the install commands in their primary form, and the main TOC entry "Quick Start" is the canonical anchor for new users. SEO impact is probably negligible for a plugin-marketplace install (where users already know they want to install from the linked marketplace).

## Open questions for the review panel

1. Is the surface-compatibility table genuinely "Installation-section content," or should it be inline near Path A/B in Quick Start (since users may want to know "will this work for me?" *before* running install commands)?
2. Is there a third option neither I nor the user considered — e.g. fold both sections into a single "Install" section with three subsections (compatibility, fresh install, upgrade), eliminating the Quick Start vs. Installation distinction entirely?
3. Are any pieces of duplicated content actually serving a purpose (e.g. mobile-reader scroll patterns, accessibility, link target stability) that would be lost by deduplication?
4. Is the proposed "pointer block at top of Installation" pattern (linking back to a previous section instead of self-contained) idiomatic for high-quality OSS READMEs, or does it look hacky?

## What we want from the panel

- **Verdict** (Approve / Approve with revisions / Reject) on whether to do the restructure as proposed
- **Specific edit suggestions** for the proposed Installation section opening pointer block (wording, tone, link text)
- **Counter-proposals** if the panel sees a better restructure
- **Risk assessment** — anything we're missing about how this change impacts new users vs. returning users vs. contributors browsing the repo
