# Architecture Critic — Phase 5 Round 1

**Document under review:** `docs/plans/2026-08-10-peer-messaging-adaptation-design.md`
**Target skill:** `skills/agent-review-panel/SKILL.md` (v3.8.3)
**Review mode:** Exhaustive
**Agreement intensity:** 50%
**Reasoning strategy:** Backward — start from the desired end state, trace back to what must hold.

**Overall Assessment:** The problem selection is right and Part 3 is exemplary, but Part 2's
safety net provably does not catch the case Part 2 exists to create, and its delivery mechanism
was never probed in the invocation shape the document itself calls frequent.

**Score: 5/10**

**Confidence: High** (on the file-level mechanism findings), **Medium** (on the nested-routing
finding, which rests on an inference the design also failed to test).

---

## Backward trace — what must be true for this change to work

Desired end state (from Part 2's own problem statement, doc lines 112–116): *an unattended panel
run never returns a clean-looking verdict when a reviewer was never reached or could not see the
code.*

For that to hold, three things must each be true:

- **E1 — Detection.** Something must notice the reviewer produced nothing useful.
- **E2 — Propagation.** That notice must reach whatever writes the report.
- **E3 — Universality.** Detection must run on every execution shape the skill supports, not
  only the well-behaved one.

Part 1 satisfies E1–E3 reasonably: an unaddressable reviewer writes no `phase_4/5/7` file, and
Phase 13.5's existence check (`SKILL.md:1128`) catches that. Part 2 fails E1 and E3, and its
push channel fails E2 in the nested shape. Details below.

---

## Findings

### AC-1 [P0] The blocked-reviewer state file passes Phase 13.5, so `COMPRESSED RUN` never fires

Part 2 rule 1 (doc line 123) requires the blocked reviewer to **"still write a state file
recording BLOCKED."** Part 2 rule 3 (doc lines 129–131) then says the orchestrator should
"count it as a missing reviewer under the existing `COMPRESSED RUN` machinery," and "Out of
scope" (doc line 208) asserts **"A new banner — `COMPRESSED RUN` already covers a reviewer that
missed a phase."**

Trace it against the actual machinery:

1. Phase 13.5 runs exactly three checks per required file (`SKILL.md:1126–1134`): existence,
   size ≥ 500 bytes (`SKILL.md:1129–1130`), and required-headers — for Phase 3, "a Score, a
   Findings section, and severity tags" (`SKILL.md:1131–1134`).
2. The Phase 3 reviewer template mandates that exact skeleton: `**Score: X/10**`,
   `**Confidence: …**`, `#### Line-by-Line Audit Findings`, `#### Strengths`, `#### Weaknesses`,
   `#### Suggestions`, `#### Key Concern` (`references/prompt-templates.md:100–128`). The same
   template instructs: *"If the line-by-line audit found nothing, state: 'Line-by-line audit: no
   issues found.'"* (`prompt-templates.md:141–143`).
3. A reviewer told to "write a state file recording BLOCKED" while following that template emits
   the full skeleton with empty findings. That is comfortably over 500 bytes, has a Score, and
   has a Findings section. **All three Phase 13.5 checks pass.**
4. Phase 15.1's COMPRESSED emission is conditioned strictly on the gate having found something
   *missing*: *"If the Phase 13.5 verification gate detected any unrecoverable missing phase
   output, Phase 15.1 MUST emit this block"* (`SKILL.md:1297–1300`). Nothing was missing.

Net effect: a blocked reviewer produces a schema-valid, zero-finding review that the gate green-
lights, and Phase 15.1's absent COMPRESSED block is then read as the documented green light
(`SKILL.md:1314–1315`). **The design reproduces the exact failure it cites** — the
`overnight-review-panel-blocked-reviewer-reads-as-clean` class.

There is an accidental escape hatch: if the BLOCKED file happens to land under 500 bytes it trips
the stub check and eventually reaches COMPRESSED. But whether the safety net fires depends on how
verbose the blocked reviewer was. That is not a design; that is a coin flip, and the design does
not specify the file's name, format, or size.

Secondary problem even if detection were fixed: the banner's own text has no vocabulary for this.
Its template is `⚠️ COMPRESSED RUN — Phases skipped: <comma-separated list>` (`SKILL.md:1303`).
Listing "3 (architecture)" for a reviewer that *did* run and *did* write a file is a false
statement in the report — and this repo treats overstated or miscategorised claims as defects in
their own right.

**Recommendation.** Either (a) add a `BLOCKED` marker the gate can test — a required
`**Status: BLOCKED**` line in the state file plus a fourth Phase 13.5 check and a distinct
`⚠️ BLOCKED REVIEWER — <persona>: <what it could not reach>` banner with its own stacking
position; or (b) forbid the blocked reviewer from writing a schema-shaped file at all and have it
write `state/reviewer_<slug>_BLOCKED.md` instead, leaving the required file genuinely absent so
the existing gate fires honestly. Option (b) is smaller and reuses more. Either way, "no new
banner" cannot stand as written. Also settle what a blocked reviewer does to
`Proceed with minimum 2 reviewers` (`SKILL.md:2115`) — does a blocked reviewer count toward the
floor?

---

### AC-2 [P0] Part 2's push to `"main"` was never probed in the nested shape the doc calls frequent

The probe table (doc lines 36–41) tests five directions. None of them is nested: every probe is
from a first-level subagent of the main conversation. The successful result reads
`"Message queued for the main conversation's next turn."` (doc line 40) — the *main conversation*,
not "the parent agent".

Two facts in the repo make the nested case the one that matters:

- The design's own Part 3 states: *"This skill is frequently invoked from inside a subagent or a
  workflow"* (doc line 155), and treats that as strong enough to decline agent teams outright.
- Multi-run mode explicitly runs each orchestration as a background subagent:
  *"Runs MAY execute in parallel if the orchestrator supports it (launching multiple run
  orchestrations as parallel background agents)"* (`SKILL.md:1971–1973`).

In both shapes the orchestrator is itself a subagent, so a reviewer's `SendMessage("main")` is
addressed to the top-level conversation, not to the orchestrator that needs it. The skill already
documents that the nested case breaks reply routing: *"when the orchestrator is itself a subagent,
reviewers' SendMessage replies may not route back and wave-completion notifications may not
arrive"* (`SKILL.md:1765–1770`).

Part 2 rule 4 (doc lines 132–134) is offered as the mitigation, but its trigger is wrong:
**"if `SendMessage` is unavailable to the reviewer."** In the nested case `SendMessage` *is*
available and returns success — the message simply lands in a conversation that cannot act on it.
The degradation clause does not cover misdelivery-with-success, only unavailability. So in the
frequent shape the push silently fails and the fallback is the state-file poll, which AC-1 shows
does not detect BLOCKED.

There is also a collateral effect the doc does not consider: in an unattended overnight run, the
top-level conversation may be an unrelated agent or an idle session. Injecting
`BLOCKED — Architecture Critic: …` into it is at best noise and at worst a confusing interrupt to
work that has nothing to do with the panel.

I am labelling the *routing* claim as inference, not measurement — but that is precisely the
finding. The repo's stated culture is that changes are measured, not guessed, and this is the one
tool behaviour on which all of Part 2 rests.

**Recommendation.** Probe `subagent-of-subagent → "main"` before writing any rule, and record the
result in the doc's verification table. If it routes to the top level (expected), then either
drop the push and invest the whole of Part 2 in a detectable state file (AC-1 option b), or scope
the push rule to non-nested runs with an explicit shape check and say plainly that in nested runs
the state file is the only channel.

---

### AC-3 [P1] The persona → agentId map has no stated home, and the orchestrator's context is the wrong one

Part 1 rule 1 says *"Record a persona → agentId map before leaving Phase 3"* (doc lines 83–84) but
never says where. The map is the only new mutable orchestrator state the design introduces, and it
is the one thing whose loss silently reverts the fix.

The repo has a settled answer for exactly this and the doc does not use it. `SKILL.md:2050–2103`
defines the v3.1.0 file-based state convention, lists every materialized orchestrator-level state
file (`SKILL.md:2058–2062`), gives the single-run and multi-run layouts (`SKILL.md:2064–2093`),
and closes with the rationale: *"every long-running multi-agent skill in the local catalog routes
intermediate outputs through disk to keep the orchestrator window small"* (`SKILL.md:2100–2103`).

Holding the map in context is the worst available option on this repo's own measurements. The
2026-07-16 audit found the orchestrator ran 157 turns with context growing 270k → 630k tokens
(`SKILL.md:1751–1753`; `docs/analysis/2026-07-16-panel-token-split-audit.md:17`). The discipline
targets ≤40 turns (`SKILL.md:1777`) but does not guarantee them. At that scale a mid-run
compaction is likely, and a compacted orchestrator loses the agentIds. Every subsequent
`SendMessage` then fails or gets skipped, the fresh-spawn fallback fires, files get written, gates
pass, and the report is clean — a pure cost regression that is invisible by construction, which
is the same species of defect Part 1 was written to remove.

**Recommendation.** Persist to `state/agent_ids.md` (and `state/run_<N>/agent_ids.md` in multi-run
mode), add it to the state-file list at `SKILL.md:2058–2062` and both layout blocks, and state the
validity rule: an agentId read from disk in a *new* session is stale and unusable, but that is safe
because rule 3 already routes `success: false` to a fresh spawn. Add a behavioral assertion for the
layout entry — the existing test at `tests/behavioral-assertions.test.mjs:370–390` is the pattern.

---

### AC-4 [P1] `success: true` is not proof of delivery — the skill already records a measured counter-example

Part 1 rule 3 (doc lines 88–91) builds the failure contract on the 2.1.222 changelog entry and
closes with *"Never read a send as delivered without checking the result."* That sentence implies
checking the result is how you establish delivery. The skill's own text, measured on the same date
against the same Claude Code build, says otherwise:

> `SKILL.md:1790–1793` — "a send into a session whose permission mode differs from the sender's
> returns `success: true` with a message id while the message is silently held for an approval
> dialog that a headless session never shows (measured 2026-08-10, Claude Code 2.1.226)."

That measurement is on the cross-session channel, so it is not automatically transitive to
subagent sends — but the design cites no measurement establishing that `success: true` means
delivered on the subagent channel either. Publishing "check the result" as the delivery contract
overstates what the evidence supports, in a skill that requires an epistemic label on every claim.

**Recommendation.** State the asymmetry explicitly: `success: false` is a *sufficient* signal of
failure and must trigger the fallback; `success: true` is **not** a delivery guarantee, and the
state file on disk remains the authority — which is what `SKILL.md:1767–1770` already tells the
orchestrator to do. One sentence, and it keeps the rule honest.

---

### AC-5 [P1] Persona name is not a unique key — Run 3 spawns three Devil's Advocates

Both new structures are keyed on persona name: the map (doc line 83) and the required message
form `BLOCKED — <persona name>: <what it could not reach>` (doc line 128).

The design itself flags the collision as a *reason* for the change — "multi-run Run 3 spawns three
Devil's Advocates concurrently" (doc line 97) — and then adopts the colliding key anyway. Verified:
`SKILL.md:1951` — "| 3 | Adversarial-heavy: 3 Devil's Advocates (different reasoning strategies) +
1 Correctness Hawk |", elaborated at `SKILL.md:1954–1957`.

So in Run 3 the map has three entries competing for one key, and `BLOCKED — Devil's Advocate: …`
identifies none of the three. The identical ambiguity applies to the state-file slug
`reviewer_{persona_short_name}_phase_3.md` (`prompt-templates.md:145`), so whatever
disambiguating slug Run 3 already needs is the natural key for both new structures.

**Recommendation.** Key the map on the same per-instance slug used for state filenames (e.g.
`devils-advocate-analogical`), and require that slug — not the display name — in the BLOCKED
message: `BLOCKED — <persona slug>: …`. Add "the map key is the state-file slug, not the display
name" to the rule text so the two never drift.

---

### AC-6 [P1] Nothing establishes that reviewers can call `SendMessage` at all

Part 2's entire mechanism assumes the reviewer subagent has `SendMessage`. The design verifies
the *direction* works (doc line 40) but never that a Phase 3 reviewer is granted the tool.

Evidence that this is unstated today: `grep -c "SendMessage" references/prompt-templates.md`
returns **0** — the doc notes this itself (doc line 58). And SKILL.md documents tool grants for
exactly one agent, the Phase 8 auditor: *"The agent has grep / Read / Bash tools"*
(`SKILL.md:1233`). Reviewer tool access is never specified anywhere.

Worse, Part 2 rule 1's own trigger list includes "no `Bash`" (doc lines 121–122) — a
degraded-capability spawn. A reviewer that lost `Bash` is plausibly the same reviewer that has no
`SendMessage`, so the push is least likely to work in exactly the situation it is meant to report.
Rule 4 then routes to the state file, which AC-1 shows does not detect BLOCKED. The two mitigations
fail together rather than independently.

**Recommendation.** State the tool assumption in the Phase 3 spawn spec, and give the reviewer a
concrete instruction for when `SendMessage` is absent (write the BLOCKED file *first*, then attempt
the push) so ordering does not depend on a tool that may not exist.

---

### AC-7 [P1] Part 2's edit-site table omits the two files that would make it work

The table (doc lines 138–142) lists three sites: the Phase 3 prompt template, SKILL.md Phase 3,
and SKILL.md Edge Cases. All three are places that *describe* the behaviour. None is a place that
*detects* it.

For a BLOCKED reviewer to reach the report, at minimum these must change and are not listed:

| Missing site | Why it is required |
|---|---|
| `SKILL.md:1126–1134` (Phase 13.5 checks) | The gate needs a fourth check, or a rule that a BLOCKED reviewer's required file counts as absent. Without this AC-1 stands. |
| `SKILL.md:1297–1315` (Phase 15.1 banner) | The COMPRESSED trigger is conditioned on 13.5 finding *missing* output; a BLOCKED-but-present file never reaches it. |
| `SKILL.md:2058–2062` + layout blocks | The BLOCKED state file needs a documented name, and (per AC-3) so does the agentId map. |
| `SKILL.md:1350–1363` (banner stacking) | Any new signal needs a defined position relative to NO-DEBATE / COMPRESSED / BUDGET-MODE. |

Part 1's table is in better shape — the four SKILL.md line references I checked all point where
the doc says: Orchestrator Efficiency Discipline does begin at `SKILL.md:1748`, Phase 3 persistent
reviewers is `SKILL.md:756–763`, Implementation Notes error handling is `SKILL.md:2115`, and the
nested caveat is `SKILL.md:1765`. One nit there: the section is given as "§ ~1748–1791" but runs to
`SKILL.md:1799` (rule 7 ends there), so an implementer working from the range would miss rule 7,
which is the one that governs when the orchestrator may read state files — directly relevant to
where the agentId map lives.

---

### AC-8 [P2] `COMPRESSED` is the weaker of the two banner mechanisms, and the design leans its whole argument on it

The doc's "no new banner" case treats COMPRESSED as a dependable backstop. The skill says
otherwise, in the section that introduces it:

> `SKILL.md:1173–1178` — "Detection is not solely anchored here. Phase 13.5 does not fire on every
> execution shape (an inline/workflow-shaped run can skip this gate entirely — that is exactly how
> the audit's silent skips slipped through). The load-bearing NO-DEBATE check therefore *also* runs
> at the Phase 15.1 report-write chokepoint."

That re-anchoring applies to NO-DEBATE only. NO-DEBATE gets an independent check at Phase 15.1
(`SKILL.md:1317–1324`) that reads disk directly and does not depend on Phase 13.5. COMPRESSED
never got one — its Phase 15.1 emission is still gated on Phase 13.5 having run
(`SKILL.md:1297–1300`).

So even setting AC-1 aside, a workflow-shaped run that skips Phase 13.5 loses COMPRESSED entirely.
This is background risk rather than something Part 2 introduces, but it undercuts the "already
covered" reasoning, and the fix is cheap.

**Recommendation.** Either give COMPRESSED the same shape-independent Phase 15.1 disk check
NO-DEBATE has, or drop "already covered" from the doc and state plainly that COMPRESSED is
best-effort on non-standard shapes.

---

### AC-9 [P2] The version-bump list is incomplete, while the doc claims version consistency is covered

Doc lines 200–203 list `package.json`, `.claude-plugin/plugin.json`, `SKILL.md:22`, and
`SKILL.md:1664`. Both line references are correct (verified: `SKILL.md:22` is
`# Agent Review Panel v3.8.3`; `SKILL.md:1664` is the HTML footer instruction). Two files carrying
`3.8.3` are missing:

- `skills/agent-review-panel/eval-suite.json:3` — `"version": "3.8.3"`. Asserted by
  `tests/manifest-consistency.test.mjs` ("marquee skill eval-suite version matches plugin.json
  version", full-semver equality) and by `scripts/release-check.sh:153`.
- `.claude-plugin/marketplace.json:12` — `"version": "3.8.3"`. Asserted by
  `tests/manifest-consistency.test.mjs` ("version matches root plugin.json version") and by
  `scripts/release-check.sh:167–171`.

CI catches both, so nothing ships broken — but doc line 196 says *"Version consistency is already
covered by `tests/manifest-consistency.test.mjs`"*, and that sentence is what makes the incomplete
list look deliberate. Note also that the SKILL.md H1 and footer are only checked at
major.minor by the node test; the full-semver check lives in `scripts/release-check.sh`.

---

### AC-10 [P2] Three separate "retry once" budgets now overlap with no stated precedence

The design adds a fourth retry path without reconciling it with three existing ones:

- Part 1 rule 3 (doc lines 88–91): `success: false` → fresh-spawn fallback.
- Part 2 rule 3 (doc lines 129–131): blocked reviewer → "re-dispatch once with explicit
  materialized paths."
- `SKILL.md:1141` — Phase 13.5: "**Single retry only.** If the second attempt also fails, do NOT
  block the run."
- `SKILL.md:2115` — Implementation Notes: "Retry failed agents once."

A reviewer whose send fails could plausibly be re-dispatched once by rule 3, once by rule 4, and
once more by Phase 13.5 — three attempts against a documented budget of one. Or, read the other
way, the rule-3 fallback consumes the Phase 13.5 budget and the gate gives up early. Both readings
are supportable from the text, which means an implementer will pick one arbitrarily.

**Recommendation.** State one sentence: whether a fallback spawn counts against the Phase 13.5
single-retry budget. Given the ≤40-turn target (`SKILL.md:1777`), it probably should.

---

### AC-11 [P2] Making the fallback routine collides with Phase 7's blindness requirement

Part 1 rule 3 is correct but changes the fallback's frequency class. Before 2.1.222 a failed send
could report success, so the orchestrator rarely knew to fall back; after it, the fallback becomes
a normal path.

The fallback is specified as *"fall back to a fresh spawn that reads that persona's prior state
files from disk"* (`SKILL.md:761–762`, restated at `SKILL.md:769–770` and `832`). Phase 7 is the
blind final: *"Others do NOT see these"* (`SKILL.md:834`). A fresh spawn pointed at `state/` with
loose instructions can read every reviewer's `phase_7.md`, and blindness is silently lost — with
no gate that would notice, because all the files exist and are well-formed.

Pre-existing, but the design is what makes the path common, so it belongs in this change.

**Recommendation.** One clause in the fallback text: the fresh spawn is given the explicit list of
*its own* prior state-file paths and must not glob `state/`.

---

### AC-12 [P3] Part 3's cross-session note is already shipped; the doc presents it as pending

Doc line 178 says the cross-session finding is *"Documented as a manual note under rule 6."* That
note already exists in v3.8.3 at `SKILL.md:1786–1794`, complete with the 2026-08-10 measurement.
Nothing to build; the doc should mark it done rather than planned, so an implementer does not add
a duplicate paragraph to a section the repo is actively trying to keep short.

---

## What the document gets right

Worth stating, because it is the reason the score is not lower:

- **Part 3 is the best section.** Four independent grounds against agent teams, each falsifiable,
  with explicit reversal conditions and a named metric to measure on reversal (doc lines 165–168).
  That is exactly the "measured, not guessed" discipline the repo asks for.
- **The honesty about v3.8.0's measurement** (doc lines 26–28) — "That does not prove the
  measurement was wrong, but it does mean a silent delivery failure was possible and invisible at
  the time" — is correctly hedged rather than overclaimed.
- **The core Part 1 defect is real and correctly diagnosed.** `grep -rn "agentId" skills/` returns
  0 (verified), and `SKILL.md:1760–1761` genuinely tells the orchestrator to drive Phases 4/5/7 via
  SendMessage without ever saying how to address the agent. Framing it as *unspecified* rather than
  *broken* (doc lines 62–66) is the right epistemic call.
- **The cost figures cited in Part 3 check out**: 69% orchestrator / 7% reviewer fan-out matches
  `docs/analysis/2026-07-16-panel-token-split-audit.md:17` and `:21`.

## Key Concern

Part 2 is the half of this change that addresses an overnight-safety failure, and both of its
mechanisms fail in the shapes that matter: the state-file backstop passes Phase 13.5 because the
Phase 3 template makes a blocked review structurally indistinguishable from a clean one, and the
push channel was never probed in the nested shape the document itself calls frequent. Fixing AC-1
is non-optional — without it, shipping Part 2 adds prose about a protection that does not exist,
which is a worse position than today, where at least nobody believes the case is handled.

## Verification commands

- AC-1: `sed -n '1126,1134p;1297,1300p' skills/agent-review-panel/SKILL.md` — expect the three
  Phase 13.5 checks and the COMPRESSED trigger conditioned on "missing phase output".
- AC-1: `sed -n '100,143p' skills/agent-review-panel/references/prompt-templates.md` — expect the
  required Score / Findings skeleton a blocked reviewer would emit.
- AC-2: `sed -n '1765,1770p;1971,1973p' skills/agent-review-panel/SKILL.md` — expect the nested
  caveat and parallel background-agent run orchestrations.
- AC-3: `sed -n '2050,2103p' skills/agent-review-panel/SKILL.md` — expect the state-file list with
  no agentId map entry.
- AC-4: `sed -n '1786,1794p' skills/agent-review-panel/SKILL.md` — expect the measured
  `success: true`-but-held case.
- AC-5: `sed -n '1951p;1954,1957p' skills/agent-review-panel/SKILL.md` — expect three Devil's
  Advocates in Run 3.
- AC-6: `grep -c "SendMessage" skills/agent-review-panel/references/prompt-templates.md` —
  Expected: `0`.
- AC-9: `grep -rn '"version"' skills/agent-review-panel/eval-suite.json .claude-plugin/marketplace.json` —
  Expected: both `3.8.3`, neither in the doc's bump list.
