# Reviewer: Correctness Hawk / Probe Verifier — Phase 5, Round 1

**Document under review:** `docs/plans/2026-08-10-peer-messaging-adaptation-design.md`
**Mode:** EXHAUSTIVE. Agreement intensity 30%.
**Method:** every messaging fact re-derived from my own probes; every repo claim re-checked
against `file:line` or verbatim command output. Nothing in the doc's section 2 was taken on trust.

---

## 0. What I could and could not probe — stated up front

The assignment asked for probes (b)–(e), all of which require spawning an agent. **I have no
agent-spawning tool.** Verbatim:

```
ToolSearch  query="select:Task,Agent,AgentTool,Dispatch"
→ No matching deferred tools found
```

My full tool inventory contains no `Agent` and no `Task`-spawn tool; the deferred list contains
`TaskCreate/TaskGet/TaskList/TaskStop/TaskUpdate`, which are the shared **task-list** tools, not
agent spawning. So probes (b), (c), (d) and (e) **could not be run from this position**, and I
report them as NOT RUN rather than inferring their results. This is itself a data point: a subagent
in this environment cannot spawn subagents, which is directly relevant to Part 3's "no nested teams"
argument and to how any future re-probe must be staged (it must be run from the main session, not
from a panel reviewer).

Probes (a), (f) and (g) were run in full, plus four extra address-form probes the assignment did not
ask for.

---

## 1. Probe results — verbatim

### (a) `SendMessage` schema — verbatim, whole description

```
# SendMessage

Send a message to another agent.

{"to": "researcher", "summary": "assign task 1", "message": "start on task #1"}

| `to` | |
|---|---|
| `"researcher"` | Teammate by name |
| `"main"` | The main conversation (background subagents only) |

Your plain text output is NOT visible to other agents — to communicate, you MUST call this tool.
Messages from teammates are delivered automatically; you don't check an inbox. Refer to agents by
name — names keep working after an agent completes (a send resumes it from its transcript). Use the
raw `agentId` (format `a...-...`) from its spawn result only when the agent has no name, or when a
newer agent took the name (latest wins). When relaying, don't quote the original — it's already
rendered to the user.
```

Parameter `to`: `{"description": "Recipient: teammate name", "pattern": "^[^\\n\\r]{0,200}$", "type": "string"}`.

Two things in that text are load-bearing and the design doc engages with neither:

1. **Names are the documented primary address. `agentId` is the documented fallback**, used "only
   when the agent has no name, or when a newer agent took the name (latest wins)."
2. `"main"` is annotated **"(background subagents only)"**.

### (g) `ListAgents` — does not exist

```
ToolSearch  query="select:ListAgents"       → No matching deferred tools found
ToolSearch  query="list agents discovery sessions teammates"
   → returns list_sessions, CronList, TaskList, list_connected_browsers,
     list_granted_applications, list_events, list_connectors, list_scheduled_tasks, SendMessage
     — no ListAgents
```

**Matches the doc.** Row 5 of its table is correct.

### (f) Subagent → `"main"`

```
SendMessage to="main" summary="probe: subagent to main channel test"
→ {"success":true,"message":"Message queued for the main conversation's next turn."}
```

Byte-identical to the string the doc quotes. But note two things the doc does not:
**(i) there is no `pin` object in this result**, and **(ii) the verb is "queued", and the delivery
point is "the main conversation's next turn"** — this is an enqueue acknowledgement, not a delivery
receipt.

### Extra probes — four address forms, one error string

```
to="Beta"
→ {"success":false,"message":"No agent named 'Beta' is reachable.\nCheck the spelling, or use the agent ID from a background agent's spawn result."}

to="a51d8f2c-0000-0000-0000-000000000000"
→ {"success":false,"message":"No agent named 'a51d8f2c-0000-0000-0000-000000000000' is reachable.\nCheck the spelling, or use the agent ID from a background agent's spawn result."}

to="5f59f9"        (the pin `ref` short id the doc reports but never tests)
→ {"success":false,"message":"No agent named '5f59f9' is reachable.\nCheck the spelling, or use the agent ID from a background agent's spawn result."}

to="general-purpose"   (the subagent_type)
→ {"success":false,"message":"No agent named 'general-purpose' is reachable.\nCheck the spelling, or use the agent ID from a background agent's spawn result."}
```

The `to="Beta"` result is byte-identical to the doc's quoted error. **But the same error comes back
for a well-formed agentId, for a pin `ref`, and for a subagent_type.** The message is a generic
"not reachable" — it carries no information about whether the *address form* is valid. Any
conclusion of the shape "form X does not resolve" cannot be drawn from this error alone; it requires
a paired control against the same live agent at the same instant.

### Line-by-line comparison against the doc's section 2 table

| Doc row | My result | Verdict |
|---|---|---|
| Orch → subagent by raw `agentId` — **works** | NOT RUN (no spawn tool) | unverified by me |
| Orch → subagent by persona name / `description` — **fails**, error string | error string **reproduces exactly** for a name that does not exist; the live-agent case NOT RUN | string ✅, inference ❌ (see F5) |
| Subagent → sibling — **fails**, identical error | NOT RUN | unverified by me |
| Subagent → `"main"` — **works**, `{"success":true,…}`, "and it was delivered" | success string **reproduces exactly**; "delivered" **not supported by the quoted evidence** — the result says *queued* | ✅ / ❌ (see F3) |
| `ListAgents` does not exist | **confirmed** | ✅ |
| "The successful send returns `pin:{id,name,ref}`" | my successful send returned **no pin** | discrepancy (see F3) |

---

## 2. Repo claims in the doc — all re-checked

| Doc claim | Check | Result |
|---|---|---|
| `grep -rn "agentId" skills/` returns zero | ran it, exit 1, no output | ✅ true |
| `prompt-templates.md` never mentions `SendMessage` | `grep -rcn "SendMessage" skills/` → only `SKILL.md:12` | ✅ true |
| "drive Phases 4, 5 …, and 7 via SendMessage" at `SKILL.md:1760` | `SKILL.md:1760-1761` | ✅ exact |
| Nested-context caveat at `SKILL.md:1765` | `SKILL.md:1765` | ✅ exact |
| Orchestrator Efficiency Discipline § ~1748–1791 | header at `SKILL.md:1748` | ✅ |
| Implementation Notes error handling § ~2115 | `SKILL.md:2115` "Retry failed agents once." | ✅ |
| Version at `SKILL.md:22` | `# Agent Review Panel v3.8.3` | ✅ |
| HTML footer at `SKILL.md:1664` | footer instruction line | ✅ |
| Audit: reviewer fan-out 7%, orchestrator 69% | `docs/analysis/2026-07-16-panel-token-split-audit.md:17` (69%) and `:21` (7%) | ✅ |
| Run 3 spawns three Devil's Advocates | `SKILL.md:1951`, `SKILL.md:1954` | ✅ |
| Sibling skill `overnight-review-panel-blocked-reviewer-reads-as-clean` exists | present in the installed skill list | ✅ |
| Test pattern `describe("v3.1.0 file-based state convention", …)` | `tests/behavioral-assertions.test.mjs:370` | ✅ |
| "Version consistency is already covered by `manifest-consistency.test.mjs`" | covered, but the doc's edit-site list is **incomplete** | ❌ (see F6) |

The doc is honest and accurate on every repo anchor it cites. Its failures are **inference** failures
and **omission** failures, not citation failures. That deserves saying plainly.

---

## 3. Findings

### F1 [P0] — "Address by agentId only, never the persona name" is the inverse of SendMessage's own documented contract, and the one mechanism that would make names work was never tested

The design writes into SKILL.md (Part 1, rule 2): *"Address by agentId only. … Never the persona
name, never the `description` string — neither resolves."*

`SendMessage`'s own description says the opposite, verbatim:

> "Refer to agents by name — names keep working after an agent completes (a send resumes it from its
> transcript). Use the raw `agentId` (format `a...-...`) from its spawn result **only when the agent
> has no name**, or when a newer agent took the name (latest wins)."

The doc bridges that gap with one asserted fact (design doc line 46): *"Agent-tool subagents have no
human-readable name."* That fact was derived from spawns that **did not set a name**. Absence of a
name on an unnamed spawn is not evidence that a name cannot be set. And there is direct evidence in
this environment that it can be — `TaskStop`'s description, verbatim:

> "- To stop an agent-team teammate, pass its agent ID (`"name@team"`) or bare teammate name as task_id
> - To stop a **background agent spawned with a name**, pass that name as task_id"

"A background agent spawned with a name" is a first-class concept in the tool surface. The design
never probes for a name parameter on the spawn call, never mentions it, and then writes a prohibition
into a 2165-line skill on the strength of an untested premise.

Why this matters beyond pedantry — three concrete consequences:

- **It costs context in the 69% component.** An agentId map is N opaque UUIDs the orchestrator must
  carry and re-read across the whole run. The audit puts the orchestrator main loop at 69% of run
  cost (`docs/analysis/2026-07-16-panel-token-split-audit.md:17`). A name costs nothing to carry —
  the orchestrator already computes a unique per-persona slug for `state/reviewer_<name>_phase_3.md`
  (`SKILL.md:754-755`).
- **It leaves Part 2's identification problem unsolved.** Part 2 rule 2 exists only because the
  envelope reports the agent *type*, not the persona, so the design has to bolt a
  `BLOCKED — <persona>:` string convention onto the message body. A named agent plausibly fixes that
  at the envelope, making rule 2 unnecessary.
- **The 2.1.212 argument cuts the other way.** The doc justifies agentId partly by name-reuse
  misrouting (design doc lines 96-98). The tool now documents that behaviour as **"latest wins"** —
  deterministic, not misrouting. And the collision case it names (Run 3's three Devil's Advocates,
  `SKILL.md:1951`) is trivially avoided by distinct names — the skill already gives those three
  *different reasoning strategies* (`SKILL.md:1954`), so distinct slugs already exist.

**Recommendation.** Do not ship rule 2 as written. Either (a) probe the spawn call for a name
parameter from the main session and, if present, make named spawns the primary contract with agentId
as the documented fallback — matching the tool's own guidance; or (b) if names genuinely cannot be
set, say so with the probe that shows it, and soften the prohibition to "the Agent tool's
`description` is not an address" rather than the unqualified "never the persona name".

*Evidence class: the SendMessage and TaskStop strings are verbatim tool output. The existence of a
`name` parameter on the spawn call is **[UNVERIFIED]** — I have no spawn tool. That is exactly why
this is a P0: the design asserts the negative without the probe either.*

### F2 [P0] — Part 2's push channel is documented "background subagents only", and the design adds no edit that makes reviewers background agents

`SendMessage`'s parameter table, verbatim: `| "main" | The main conversation (background subagents only) |`

The skill launches reviewers as ordinary parallel Agent calls. `SKILL.md:743`:

> "Launch ALL reviewer agents **in parallel** using Agent tool with `model: "opus"`."

There is no `run_in_background` anywhere in SKILL.md (`grep -n "background\|run_in_background"` returns
only `SKILL.md:1972`, about multi-**run** orchestrations, plus CSS `background:` colours at 1612/1628).
"In parallel" here means several Agent calls in one message — concurrent, but not background.

Part 2's edit-site table (design doc lines 138-142) lists exactly three edits: the Phase 3 prompt
template, SKILL.md Phase 3 prose, and a new Edge Case. **None of them makes Phase 3 spawns background
agents.**

So the most likely outcome of shipping Part 2 as specified: reviewers cannot reach `"main"` at all,
every run silently takes the rule-4 fallback (state file only), and SKILL.md carries text claiming a
live push channel that never fires. A feature whose entire purpose is to stop a silent
no-findings-reads-as-clean failure would itself fail silently. That is the exact defect class this
repo's culture names as unacceptable.

**Recommendation.** Either add "spawn Phase 3 reviewers as background agents" to the Part 2 edit
sites — and then measure what that does to the wave-completion and polling behaviour described at
`SKILL.md:1765-1771`, because it changes it — or establish by probe that a blocking parallel subagent
can also reach `"main"`, and record that probe. Do not ship on the assumption.

### F3 [P0] — "Queued for the next turn" is not delivery, and the orchestrator has no next turn during a wave, so Part 2's stated benefit does not follow

Design doc lines 120-122: *"The verified `subagent → "main"` channel makes this reportable at the
moment it happens rather than at return time."*

My probe result, verbatim: `{"success":true,"message":"Message queued for the main conversation's next turn."}`

Three problems, all in one place:

1. **"Queued", not delivered.** The doc's table asserts "and it was delivered" (design doc line 40).
   The tool result it quotes as its evidence establishes enqueueing only. The delivery claim carries
   no evidence in the document.
2. **"Next turn" is the wrong moment.** The skill's own nested-context guidance (`SKILL.md:1768-1771`)
   is: *"after dispatching a wave, do NOT end the turn to 'wait' — poll the state directory for the
   expected files (sleep loop), verify, and proceed."* A sleep-loop poll happens **inside one
   orchestrator turn**. A message queued for the next turn therefore lands at or after the point the
   orchestrator was already going to read the state file. The claimed acceleration is plausibly zero,
   and it is unmeasured either way.
3. **The `pin` observation is mis-attributed.** Design doc line 45 says *"The successful send returns
   `"pin":{"id":"a51d…","name":"a51d…","ref":"5f59f9"}`"*, and builds the load-bearing claim
   *"The `name` **is** the agentId"* on it. But the only successful send in the doc's own table is the
   `→ "main"` one, and the doc quotes that result **without a pin** (line 40). My successful send to
   `"main"` also returned no pin. So the pin must have come from a different send that the doc does
   not identify. A reader cannot tell which send produced the evidence for the doc's central
   addressing claim.

**Recommendation.** Drop "at the moment it happens" unless it is measured against the polling
baseline. Change "it was delivered" to what the evidence supports, or add the arrival evidence.
State which send produced the `pin`, and re-probe whether `pin.ref` is addressable against a live
agent (my probe of a stale `ref` is inconclusive — see F5).

### F4 [P1] — Rule 3's premise overstates what `success: true` guarantees

Part 1 rule 3: *"Since Claude Code 2.1.222, `SendMessage` returns `{"success": false, …}` when
delivery fails. … Never read a send as delivered without checking the result."*

The second sentence implies the converse — that checking the result *does* establish delivery. My
probe shows `success: true` accompanied by the word "queued" and a future delivery point. For the
`"main"` channel at least, `success: true` means accepted-for-queueing.

If Part 1 rule 3 goes into SKILL.md as written, the orchestrator is being told a checked send is a
delivered send. That is a new false claim in a skill whose culture is that overstatement is itself a
defect.

**Recommendation.** Say what the result actually means: `success: false` is a definite failure and
triggers the fallback; `success: true` is acceptance, not proof of delivery, and the state file
remains the delivery evidence. That is also consistent with `SKILL.md:1768-1771`, which already says
the state files are the reliable signal.

### F5 [P1] — The "does not resolve" conclusion is not established by the error string the doc quotes

The doc's rows 2 and 3 both rest on one generic error. I got the identical error for four different
address forms including a syntactically perfect UUID:

```
to="Beta"                                    → No agent named 'Beta' is reachable. …
to="a51d8f2c-0000-0000-0000-000000000000"    → No agent named 'a51d…' is reachable. …
to="5f59f9"                                  → No agent named '5f59f9' is reachable. …
to="general-purpose"                         → No agent named 'general-purpose' is reachable. …
```

"Not reachable" is returned for *any* unresolvable address. It does not distinguish "this form is not
an address" from "no such agent exists / it already completed". To establish "the `description`
string does not resolve as an address" you need a **paired control**: one live agent, one instant,
`to=<description>` fails **and** `to=<agentId>` succeeds. The doc presents those as separate table
rows and never states they were paired.

The conclusion may well be right. The evidence as written does not carry it, and in this repo an
unmeasured claim presented as verified is the defect.

**Recommendation.** Re-run the probe as an explicit paired control from the main session and record
both results in the same block, or downgrade the table row's epistemic label. Also note: the pin
`ref` is still **untested against a live agent** — my probe used the doc's stale `ref` from a
different session, which would fail regardless. `"name@team"` (from `TaskStop`'s description) is a
third documented address format the doc does not mention.

### F6 [P1] — Three CI-gated edit sites are missing from "Version and documentation"; implementing exactly what the doc lists turns CI red

The doc lists: `package.json`, `.claude-plugin/plugin.json`, `SKILL.md:22`, `SKILL.md:1664`,
`CHANGELOG.md`, `references/changelog.md`, `ROADMAP.md` — then reassures that
"Version consistency is already covered by `tests/manifest-consistency.test.mjs`."

Missing, all three enforced in CI (`.github/workflows/test.yml:25` runs `npm test`, `:28` runs
`bash scripts/release-check.sh`):

1. **`skills/agent-review-panel/eval-suite.json:3`** — `"version": "3.8.3"`. Gated twice: by
   `scripts/release-check.sh` (`check_version_in "skills/agent-review-panel/eval-suite.json"`) and by
   `tests/manifest-consistency.test.mjs:197` ("marquee skill eval-suite version matches plugin.json
   version" — **full semver**, not major.minor).
2. **`.claude-plugin/marketplace.json:12`** — `"version": "3.8.3"`. Gated by release-check's
   `MP_ENTRY_VERSION` comparison.
3. **`README.md:437` and `README.md:440`** — "The test suite (499 tests)…" / "`npm test` # run all
   499 tests". Gated by release-check section 4, which runs `npm test`, greps `[0-9]+ tests` out of
   README, and fails on any mismatch. Current actual: `npm test` → `ℹ tests 499  ℹ pass 499  ℹ fail 0`.
   The design adds six new test cases → 505 → **deterministic red**.

The reassurance sentence is the problem: a consistency test covers the version by *failing*, which
only helps if the edit-site list is complete. As written, it invites the implementer to skip the sweep.

**Recommendation.** Add all three to the edit-site table, and replace the reassurance with the
operative instruction: run `bash scripts/release-check.sh` before opening the PR.

### F7 [P1] — `SendMessage` is a deferred tool; a blocked reviewer will not find it and the push will silently never fire

In this environment `SendMessage` is not in a subagent's loaded tool set. Verbatim from the harness:

> "The following deferred tools are now available via ToolSearch. Their schemas are NOT loaded —
> calling them directly will fail with InputValidationError. Use ToolSearch with query
> `select:<name>[,<name>...]` to load tool schemas before calling them: … SendMessage …"

I had to call `ToolSearch query="select:SendMessage"` before I could use it. Part 2 rule 1 instructs
the reviewer to *"send a message to `"main"` immediately, before doing anything else."* A reviewer
that scans its tool list, sees no `SendMessage`, and concludes the tool is unavailable will take
Part 2's own rule-4 fallback — which means the push never happens, on every run, invisibly. Rule 4
makes that *safe*, but it also makes Part 2 a no-op while SKILL.md advertises a live channel.

**Recommendation.** The Phase 3 template clause must name the load step explicitly — "load it with
`ToolSearch` (`select:SendMessage`) first; if it does not load, write the state file and continue" —
and the Part 2 rule-4 wording should distinguish "tool absent" from "tool not yet loaded".

*Scope note: I observed the deferred-tool arrangement in this session only. It should be confirmed to
be the general case before the wording is finalised, but the fix is cheap and harmless either way.*

### F8 [P2] — Inserting four rules renumbers the discipline and breaks the design doc's own cross-reference

Part 1 says the change is *"a new numbered item"* (singular) inserted *"immediately after the existing
rule 2"*, then presents **four** numbered items restarting at 1. It is not determinable from the doc
whether the implementer should add one rule with four sub-points or four rules 3–6.

If four rules are inserted, the existing fresh-session rule 6 becomes rule 10 — and Part 3 of this
very document cites *"Orchestrator Efficiency Discipline rule 6"* (design doc line 173). The
cross-reference goes stale the moment the design is implemented.

The prose summaries at `SKILL.md:1866-1869` and `SKILL.md:2128-2132` describe the discipline by
content, not by number, so they are safe. The `v3.8.0` test block
(`tests/behavioral-assertions.test.mjs:1114`) matches on content regexes and a section slice, so it
also survives — but only because it happens not to be number-coupled.

**Recommendation.** State the resulting numbering explicitly, and fix Part 3's reference in the same
edit.

### F9 [P2] — Rule 3 routes a failed send to a different fallback than the two the skill already documents

Part 1 rule 3 sends `success: false` to *"the documented fresh-spawn fallback, under the existing
'retry failed agents once' rule in Implementation Notes"* (`SKILL.md:2115`). But the skill already has
a specific, different fallback for exactly this event, stated twice:

- `SKILL.md:1763-1764`: *"Fallback: if SendMessage fails or is unavailable, fresh-spawn the persona
  with instructions to read its own prior `state/` files from disk."*
- `SKILL.md:760-762`: the same rule restated in Phase 3.

"Retry failed agents once" and "fresh-spawn the persona reading its own state files" are different
behaviours. Conflating them in a new rule creates an ambiguity where the skill currently has none.

**Recommendation.** Point rule 3 at the rule-2 fallback (the one that exists for this event) and say
whether the Implementation-Notes retry applies on top of it or instead of it.

### F10 [P2] — Part 3 calls the orchestrator "cheap" two sentences after citing the audit that says it is 69% of run cost

Design doc lines 157-160: *"The 2026-07-16 audit put reviewer fan-out at 7% of run cost and the
orchestrator main loop at 69%; moving relay work off a **cheap orchestrator** onto expensive teammates
is not obviously a saving."*

Verified against the audit: `docs/analysis/2026-07-16-panel-token-split-audit.md:17` is the 69%
orchestrator row; `:21` is the 7% reviewer row. The orchestrator is the *expensive* component by the
doc's own citation. The sentence inverts the evidence it just quoted.

The conclusion (don't build it, it is unmeasured and experimental) is sound and I do not dispute it.
The supporting sentence is simply wrong and would be caught by any reader who opens the audit.

**Recommendation.** Rewrite as: the audit shows relay work sits in the 69% orchestrator loop, so
moving it *might* help — which is precisely why it needs measuring, and why an experimental flag we
cannot measure behind is the blocker.

### F11 [P2] — "No new banner" is asserted, not shown, for the reviewer-never-started case

Part 1 rule 4 and Part 2 rule 3 both route a lost reviewer into `COMPRESSED RUN`. That machinery is
defined around **phases skipped** — `SKILL.md:1303`:

> `⚠️ **COMPRESSED RUN — Phases skipped: <comma-separated list, e.g., "4 (security), 5 (security, devils-advocate)">**`

A reviewer that missed Phase 5 fits that shape cleanly. A reviewer **blocked at Phase 3** never
produced anything at all — the skill's handling for that is a different line,
`SKILL.md:2115`: *"Proceed with minimum 2 reviewers. Note gaps in report."* Whether the COMPRESSED
header renders sensibly for "reviewer never started" (does it list every phase 3–7 for that persona?)
is not addressed, and the design's six proposed tests do not cover the rendering — they only assert
that SKILL.md contains the words.

Given that this exact failure mode is the one the sibling skill
`overnight-review-panel-blocked-reviewer-reads-as-clean` was written about, "no new banner" needs to
be demonstrated rather than asserted.

**Recommendation.** Either show the rendered header for a Phase-3-blocked persona, or add a test that
pins it. The YAGNI instinct against a new banner is right; the claim that the existing one covers
this case still needs one line of evidence.

---

## 4. What the doc gets right, plainly

- Every `file:line` anchor it cites is correct. I checked all nine.
- The two verbatim tool strings it quotes reproduce byte-for-byte.
- `ListAgents` really is absent, and deferring cross-session messaging on that basis is correct.
- The audit numbers are quoted accurately (69% / 7%).
- The Run 3 three-Devil's-Advocates claim is real (`SKILL.md:1951`).
- Part 3's decision to decline agent teams is well-argued and correctly refuses to ship an unmeasured
  change; the "reversal conditions" paragraph is the right shape and names what would be measured.
- The Part 2 rule-4 graceful degradation ("the push is an accelerator, not a dependency") is the right
  instinct and is what keeps F2 and F7 at "ships as a no-op" rather than "ships broken".

## 5. Bottom line

The document's honesty about its own repo citations is good. Its problem is that the **probe evidence
does not carry the weight the design puts on it**. Two of the three claims that Part 1 and Part 2 are
built on — that names cannot address an agent, and that the `→ main` push is immediate — are asserted
beyond what the recorded results show, and the tool's own documentation says the opposite of the first
one. Part 2 additionally targets a channel documented as background-only without making the reviewers
background agents.

This is not a document to reject. It is a document that needs its section 2 re-probed from the main
session with paired controls, a name-parameter probe, and a background-vs-blocking probe, before any
of it is written into a 2165-line skill as a normative rule.
