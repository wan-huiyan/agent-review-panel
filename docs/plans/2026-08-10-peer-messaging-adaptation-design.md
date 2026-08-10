# Design — reviewer addressing and blocked-reviewer handling (v3.9.0)

**Date:** 2026-08-10
**Status:** design, revised after adversarial panel review
**Skill:** `agent-review-panel` v3.8.3 → v3.9.0

> **Scope note.** This started as "adapt the skill to Claude Code's peer messaging update". After
> verification it is mostly **not** an adaptation to anything new. Two of the three shipped changes
> are defects the skill already had; the messaging update only made them visible and checkable. The
> title reflects what the change actually is.

---

## 1. What changed upstream

Version attributions below were taken from the raw `anthropics/claude-code` CHANGELOG, mapping each
entry to its enclosing `## X.Y.Z` header. **An earlier draft of this document got all three wrong**
(see Corrections).

| Version | Entry |
|---|---|
| **2.1.224** | "Added cross-session `SendMessage`: Claude Code sessions can now message each other, on any of your machines, with `ListAgents` to discover them (macOS and Linux)" |
| **2.1.224** | "Fixed `SendMessage` reporting "Message sent" when the write to a teammate's inbox had actually failed; failed deliveries are now reported as errors" |
| **2.1.199** | "Fixed `SendMessage` silently misrouting when a re-spawned agent reuses a previous agent's name — the tool now detects the mismatch and asks the caller to retarget" |

And the entry that reframes this whole change:

> **2.1.77** — "The Agent tool no longer accepts a `resume` parameter — use `SendMessage({to: agentId})`
> to continue a previously spawned agent"

Addressing a subagent by its `agentId` has been the documented method since **2.1.77**. Part 1 is not
adapting to a new capability — it is writing down a contract that has been stable for many releases
and that this skill never recorded. What 2.1.224 changed is that a failed send now returns an error
instead of reporting success, so the gap is finally *detectable*.

## 2. What we verified

Probed against Claude Code 2.1.226 on macOS by spawning real agents.

| Direction | Result |
|---|---|
| Orchestrator → subagent, by raw `agentId` | **works** — resumes from transcript, message is read |
| Orchestrator → subagent, by persona name or the Agent tool's `description` | **fails** — `{"success":false,"message":"No agent named 'Beta' is reachable.\nCheck the spelling, or use the agent ID from a background agent's spawn result."}` |
| Subagent → sibling subagent | **fails** — identical error; there is no sibling mesh |
| Subagent → `"main"`, from a **background** spawn | **works** — `{"success":true,"message":"Message queued for the main conversation's next turn."}` |
| Subagent → `"main"`, from a **foreground** spawn | **works** — same result, despite the schema annotating this recipient "(background subagents only)" |
| **Foreground** spawn returns an `agentId` | **yes** — so no background-spawn mandate is needed anywhere |
| `ListAgents` | **not exposed** to this session's main loop or its Agent-tool subagents. It is **not** absent from the machine — see below |

Supporting observations:

- The successful send returns `"pin":{"id":"a51d…","name":"a51d…","ref":"5f59f9"}`. The `name` **is**
  the agentId. Agent-tool subagents have no human-readable name, which is why the raw agentId is the
  correct branch of `SendMessage`'s own guidance ("use the raw `agentId` … when the agent has no
  name"). Write the rule as *panel reviewers have no name*, not as a per-surface rule.
- **`ListAgents` exists on this machine.** 22 real `"name":"ListAgents"` tool invocations across 39
  transcript files, including on the day this document was written. Sessions that have it also get a
  different failure suffix — "Use ListAgents to see everyone you can message" rather than the
  agentId hint above. The capability is per-surface, not absent.
- A subagent's push to `"main"` arrives tagged with the agent *type* (`general-purpose`) in one case
  and the raw agentId in another — never the persona. Recorded because it constrains any future
  design that tries to identify a sender from the envelope.
- **The push is delivered no earlier than the return value.** The result says "queued for the main
  conversation's **next turn**", and a foreground reviewer blocks the orchestrator until it returns.
  Phase 3 launches reviewers as foreground parallel Agent calls (`SKILL.md:743`), so an early push
  cannot be acted on early. This is why Part 2 does not use it.

This matches Anthropic's documentation: subagents "report results back to the main agent only" and
never talk to each other. Direct peer messaging exists only in **agent teams**.

## 3. Current state of the skill

`grep -rn "agentId" skills/` returns zero. `grep -rin "blocked" skills/agent-review-panel/` returns
zero. `prompt-templates.md` never mentions `SendMessage`.

SKILL.md tells the orchestrator to drive Phases 4, 5 and 7 by `SendMessage` "to these same agents"
(`SKILL.md:1760`) but never says what string identifies them.

The claim is **not** that persistent reviewers are broken. The fallback is documented inline at all
four dispatch sites, correctness is protected, and six of the seven efficiency rules never touch
`SendMessage` — so the review still comes out right and the measured 51-turn orchestrator figure
does not depend on this. The defect is narrower: **whether a run uses the cached reviewer or
silently reverts to the expensive fresh-spawn path is left to chance, and nobody can tell afterwards
which happened.** In a skill whose central claim is that degraded rigor must be announced rather
than silent, an unannounced fallback is the wrong default.

---

## Part 1 — Reviewer addressing contract

### Rule

**Append** to Orchestrator Efficiency Discipline rule 2. Do not reword it — `behavioral-assertions.test.mjs`
pins the exact strings `**Persistent reviewers** — spawn each persona ONCE in Phase 3` and
`Fallback: if SendMessage fails or is unavailable, fresh-spawn` by regex.

1. **Capture the agentId.** Every Phase 3 spawn result carries an `agentId` (verified for foreground
   and background spawns alike). Record a persona → agentId map before leaving Phase 3; per-run in
   multi-run mode. Keep it in orchestrator context — do **not** write a state file for it, because
   nothing would ever read it.
2. **Address by agentId only.** Panel reviewers are spawned without a name, so the raw agentId is
   the only address that resolves. Never the persona label, never the `description` string.
3. **A failed send is a failed agent.** Since 2.1.224, `SendMessage` returns `{"success": false, …}`
   on a delivery failure. Treat it as a failed agent under the existing retry-once rule in
   Implementation Notes, triggering the fresh-spawn fallback in the same turn.
4. **Applies to budget mode too** — `SKILL.md:1839` drives budget-mode Phase 7 through the same
   persistent reviewers.

Addressing by agentId also disposes of the name-reuse misrouting fixed in 2.1.199, which this skill
is exposed to because Run 3 spawns three Devil's Advocates concurrently.

### Part 1b — the fresh-spawn fallback currently produces an amnesiac reviewer

SKILL.md promises five separate times that a freshly spawned replacement "reads its own prior state
files from disk". `prompt-templates.md` contains no such instruction — the Phase 4, 5 and 7 templates
are plain prompt bodies that assume the reviewer remembers its earlier work. When the fallback fires,
the replacement receives a debate prompt with no knowledge of its own Phase 3 findings, answers
anyway, and the resulting file passes the Phase 13.5 gate on size and headers.

This is the failure path Part 1 routes more traffic onto, so it is fixed in the same change: one
preamble line in the Phase 4, 5 and 7 templates — *if you were freshly spawned rather than resumed,
read your own prior `state/reviewer_<name>_phase_*.md` files before answering.*

### Edit sites

| File | Change |
|---|---|
| `SKILL.md` Orchestrator Efficiency Discipline, rule 2 (~1760–1770) | Append the four addressing sub-rules |
| `SKILL.md` Phase 3, "Persistent reviewers (v3.8.0)" (~758–762) | One pointer sentence: capture the spawn result's agentId |
| `SKILL.md` Implementation Notes error handling (~2115) | `success: false` is a failed agent under retry-once |
| `references/prompt-templates.md` Phases 4, 5, 7 | The fresh-spawn preamble line |

## Part 2 — A blocked reviewer is not a clean vote

### Problem

A reviewer that cannot see the code returns no findings, and no findings reads as agreement. Phase
13.5 does not catch it: the gate runs exactly three checks — file exists, ≥500 bytes, required
headers present (`SKILL.md:1126–1134`). A reviewer that saw nothing but writes a well-formed "no
findings" review passes all three, no banner fires, and the judge counts it as genuine agreement.
This is the only place the panel can currently produce a false clean result, and it is the failure
class the sibling skill `overnight-review-panel-blocked-reviewer-reads-as-clean` exists for.

### Rule

**No messaging feature is involved.** The push to `"main"` was considered and cut — see Corrections.

1. **Phase 3 reviewer template:** if you cannot read the work under review — no `Bash`, the branch is
   not in the working tree, a path does not exist — write `state/reviewer_<slug>_BLOCKED.md` naming
   what you could not reach, **instead of** your required phase file, and declare the blockage in
   your ≤50-word return. Do not return findings as though you had reviewed.
2. **Because the required file is genuinely absent**, the Phase 13.5 existence check fails through
   the path that already exists: the gate re-dispatches once, and if the reviewer is still blocked
   it counts as a missing reviewer and `COMPRESSED RUN` fires. No new gate logic, no fourth check,
   no new banner, no banner-stacking decision.
3. **Orchestrator rule:** a BLOCKED reviewer is never a clean vote. Re-dispatch once with explicit
   materialized paths before counting it.

### Edit sites

| File | Change |
|---|---|
| `references/prompt-templates.md` Phase 3 template | The blocked-reviewer clause and the `_BLOCKED.md` filename |
| `SKILL.md` Phase 3 (~742–762) | The not-clean rule |
| `SKILL.md` Edge Cases | New entry: reviewer cannot see the work under review |

Phase 13.5 and Phase 15.1 need **no change** — writing the BLOCKED file in place of the required file
routes this through the existing detector.

## Part 3 — Declined and deferred

Recorded so it is not re-litigated. Neither is built in v3.9.0, including no note in SKILL.md.

### Agent teams (peer-to-peer debate mesh) — declined

- **No nested teams.** A teammate cannot spawn teammates, and this panel is often invoked from inside
  a subagent or workflow. *(How often is unmeasured — see Corrections. It is a real constraint, not a
  quantified one.)*
- **Experimental and off by default**, behind `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
- **Cost points the wrong way.** Teammates are full Claude Code sessions; the 2026-07-16 audit put
  reviewer fan-out at 7% of run cost and the orchestrator main loop at 69%.
- **It would disable the sycophancy detector.** Phase 6 works by counting position changes toward the
  majority and injecting an alert into the *next round's* prompt (`SKILL.md:809–811`). That requires a
  vantage point that sees every reviewer's round-N answer before round N+1 is written. A free-running
  mesh has no such barrier, so the check cannot run at all. This is a structural consequence, not a
  prediction about behaviour.

**Reversal conditions.** Revisit when agent teams leave experimental **and** nested teams are
permitted. Measure Phase 5 only, against the existing star topology, on finding count and sycophancy
rate — not on cost alone.

### Cross-session messaging — deferred

`ListAgents` is available on this machine, just not exposed to this session's subagents, so the
capability is real. Deferred on the merits rather than on availability: messages carry plain text
only and therefore cannot hand over a report; the receiver's `crossSessionInbound` policy can hold or
refuse delivery; an unanswered approval dialog drops the message after five minutes; macOS and Linux
only; and this skill is distributed publicly so it must work where the feature is absent. Rule 6
already tells the user what to do about a context-heavy session. **Nothing is added to SKILL.md** —
a caveat there would hard-code several short-shelf-life facts into the file that costs most to carry.

---

## Tests

Following the existing `describe("v3.1.0 file-based state convention", …)` pattern — regex assertions
against SKILL.md and `prompt-templates.md` text. Insert at a distinctive location, not appended to
the end of the file, because a parallel branch is also adding a block here.

New block `describe("v3.9.0 reviewer addressing contract", …)`:

1. The Efficiency Discipline section contains `agentId`
2. It forbids addressing a reviewer by persona name or `description`
3. It names `success: false` as a delivery failure
4. Multi-run maps are per-run
5. The Phase 4/5/7 templates instruct a freshly spawned reviewer to read its prior state files
6. The Phase 3 template contains the blocked-reviewer clause and the `_BLOCKED.md` filename
7. SKILL.md states a BLOCKED reviewer is not counted as clean

## Version and documentation

Bump 3.8.3 → **3.9.0** across all CI-gated surfaces — `manifest-consistency.test.mjs` enforces that
the marquee skill's version tracks `plugin.json`:

- `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json:12`
- `skills/agent-review-panel/SKILL.md:22` and the HTML footer string at `SKILL.md:1664`
- `skills/agent-review-panel/eval-suite.json:3` and its `updated` field
- `README.md` test counts and a v3.9 version-history row
- `CHANGELOG.md`, `references/changelog.md`, a `ROADMAP.md` row

Run `bash scripts/release-check.sh` before opening the PR. **Note:** its test-count check is
currently dead — line 110 greps `'^# tests'` while the reporter emits `ℹ tests 499`, so
`ACTUAL_TESTS` is empty and the block is skipped. Update the README count manually and confirm with
`npm test`. The dead gate is a separate defect; do not fix it here.

## Out of scope

- Any change to persona selection, debate rounds, verification phases, or the judge
- A new banner — `COMPRESSED RUN` already covers a reviewer that missed a phase
- Mandating background Agent spawns — unnecessary, foreground spawns return an agentId
- Any `state/reviewer_agent_ids.md` or dispatch-failure ledger — nothing would read it
- Touching the frontmatter description — invisible to triggering, and 31 characters from the cap
- Building agent-teams support or cross-session handoff
- The multi-run persona-slug collision (Run 3's three Devil's Advocates would all write
  `reviewer_devils-advocate_phase_3.md`), the dead release-check gate, and the Workflow recipe's
  silent phase compression. All real, all unrelated to this change, each deserving its own commit.

---

## Corrections from review

An adversarial panel (four reviewers, one debate round, Opus judge) returned **SOUND WITH
AMENDMENTS**. That run was itself compressed — three of sixteen phases, omitting the claim- and
severity-verification passes — so its verdict is treated as Medium confidence and every load-bearing
claim below was re-verified by hand.

| Claim | Outcome |
|---|---|
| Version attributions 2.1.222 / 2.1.212 / 2.1.220 | **Wrong.** Corrected to 2.1.224 / 2.1.199 / 2.1.224 against the raw changelog. A web fetch had also returned 2.1.196; also wrong |
| "`ListAgents` does not exist in this environment" | **Wrong** — over-generalised from one probe. 22 invocations across 39 transcripts on this machine. Corrected; the deferral stands on other grounds |
| Part 2's push makes blockage reportable "at the moment it happens" | **Wrong.** The push is queued for the next turn and a foreground reviewer blocks the orchestrator until it returns, so it is delivered no earlier than the return value. Push cut |
| A peer P0: the push is a "silent no-op" from a foreground subagent | **Refuted** — delivery succeeds. But its conclusion was right for a different reason (ordering, not delivery), and the push is cut anyway |
| "A mesh plausibly increases sycophancy" | **Too loose** — replaced with the structural argument that Phase 6's detector needs a round barrier a mesh does not have |
| "Phase 13.5 already covers the blocked reviewer" (three reviewers) | **Rejected.** The gate checks existence, size and headers; a well-formed blind review passes all three |
| Release-check "fails any README count that disagrees" | **Wrong** — that gate is dead. Version surfaces are gated; README counts are not |
| Mandate background spawns so an agentId exists | **Rejected** — foreground spawns return one (verified) |
| Two findings citing `SKILL.md:1786–1794` text | **Rejected** — that text does not exist in the repo; those lines are Efficiency Discipline rule 7 |
