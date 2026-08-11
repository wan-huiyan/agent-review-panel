# Devil's Advocate — Phase 5, debate round 2

**Persona:** Devil's Advocate (analogical reasoning) · **Agreement intensity:** 20%
**Score:** 6.5 → **5.5** · **Date:** 2026-08-10

I ran fresh probes this round rather than re-reading the same lines. Three of them changed
my position, and one of them falsifies a peer P0.

---

## 1. Points of agreement — what I now accept, and what convinced me

### 1a. I accept Probe Verifier's F1. It is the finding of the round, and it kills my own DA-8.

I loaded the SendMessage schema myself. Verbatim, from the tool description:

> Refer to agents by name — names keep working after an agent completes (a send resumes it
> from its transcript). Use the raw `agentId` (format `a...-...`) from its spawn result **only
> when the agent has no name**, or when a newer agent took the name (latest wins).

And from TaskStop, verbatim:

> - To stop a background agent **spawned with a name**, pass that name as task_id

The design's Part 1 rule 2 — "Address by agentId only … Never the persona name … neither
resolves" (doc:85-87) — is the exact inverse of the tool's own documented contract, and it
rests on the doc's premise at line 46 that "Agent-tool subagents have no human-readable name."
TaskStop's wording is direct evidence that named background agents exist.

**This retracts my DA-8.** In round 1 I argued the name-reuse paragraph (doc:96-98) should be
deleted *because* names do not exist. I took the doc's unverified premise and used it as a
lever against the doc's own conclusion. That was sloppy: I inherited the error I was
attacking. The correct move is F1's — probe whether the spawn call accepts a `name`
parameter, and let that decide.

What survives from DA-8 is only an internal-consistency note, now P3: the doc cannot
simultaneously argue "names do not exist, so use agentId" (line 46) and "names collide across
concurrent Devil's Advocates, so use agentId" (lines 96-98). Whichever probe result comes
back, one of those two paragraphs has to go.

**Caveat on F1's severity — see §5.** I could not verify the spawn-tool question either.
`ToolSearch query="spawn agent background subagent name parameter"` returned SendMessage,
TaskStop, EnterWorktree, ExitWorktree, Monitor, RemoteTrigger, TaskUpdate and DesignSync —
no agent-spawn tool. So F1's central factual question is still open for both of us.

### 1b. I accept F6 / P1-5. The README test-count gate is real and I missed it.

Verified:

```
README.md:437: The test suite (499 tests) uses Node's built-in test runner …
README.md:440: npm test                    # run all 499 tests
```

and `scripts/release-check.sh` section 4:

```
ACTUAL_TESTS=$(npm test 2>&1 | grep -E '^# tests' | awk '{print $3}' || echo "")
README_CLAIMS=$(grep -oE '[0-9]+ tests' README.md | sort -u || true)
WRONG_CLAIMS=$(echo "$README_CLAIMS" | grep -v "^${ACTUAL_TESTS} tests$" || true)
```

Adding six tests moves 499 → 505 and turns release-check red on two README strings. My DA-10
had the bump list short by two files (`marketplace.json:12`, `eval-suite.json:3`); with README
it is **short by three surfaces, not two**. DA-10 updated accordingly.

### 1c. I accept the channel-class question in F2 / AC-2, but not its severity (see §2c).

I confirmed the annotation verbatim from the schema I loaded:

```
| `"main"` | The main conversation (background subagents only) |
```

and that `grep -n "SendMessage" skills/agent-review-panel/SKILL.md` shows the skill drives
Phases 4/5/7 and budget-mode Phase 7 (line 1839) through it, while reviewers are launched as
ordinary blocking parallel Agent calls. The design never addresses the background/blocking
distinction. That is a real gap in the doc. It is not, however, the P0 F2 says it is — I
falsified the specific prediction below.

---

## 2. Points of disagreement — with verification

### 2a. Architecture Critic's AC-4 and AC-12 both cite text that does not exist in SKILL.md.

This is the most serious thing I found this round, and it is in a peer review rather than in
the design.

AC-4 quotes, as evidence, `SKILL.md:1790-1793`:

> "a send into a session whose permission mode differs from the sender's returns `success:
> true` with a message id while the message is silently held for an approval dialog that a
> headless session never shows (measured 2026-08-10, Claude Code 2.1.226)"

AC-12 cites the same region for "the note already exists, complete with the 2026-08-10
measurement, at skills/agent-review-panel/SKILL.md:1786-1794."

Neither exists. Verbatim results:

```
$ grep -rn "silently held for an approval dialog" .
docs/reviews/2026-08-10-peer-messaging-design/state/reviewer_architecture_phase_5_round1.md:175
$ grep -rn "crossSessionInbound" .
docs/plans/2026-08-10-peer-messaging-adaptation-design.md:175
$ grep -rn "2\.1\.226" .
docs/plans/…design.md:13, docs/plans/…design.md:32, and three reviewer state files
$ grep -n "Claude Code 2\.1" skills/agent-review-panel/SKILL.md
(no output)
```

The only place that sentence occurs anywhere in the repository is inside the Architecture
Critic's own round-1 file. I then read `SKILL.md:1748-1800` in full: the Orchestrator
Efficiency Discipline runs rules 1-7 and ends at line 1791, rule 6 is the fresh-session
recommendation (1783-1787) and contains no cross-session text, rule 7 is the read-state-files
rule. There is no cross-session note in the skill.

Consequences, both of which matter for what gets implemented:

- **AC-4's conclusion survives, its evidence does not.** "success:true is acceptance, not
  delivery" is independently established by F4's real probe output ("Message queued for the
  main conversation's *next turn*") and by my own probe below. The conclusion should be
  credited to F4. AC-4 as written must not reach the report — a fabricated file:line in a
  repo whose culture is "measured, not guessed" is precisely the defect class the panel
  exists to catch.
- **AC-12 inverts the correct action.** It tells the implementer the cross-session note
  already shipped and to mark it done. It has not shipped. If anything the opposite finding
  is available: doc:177-178 says cross-session is "Documented as a manual note under rule 6"
  while doc:146 says "Neither is built in v3.9.0", and no edit-site table lists it — so it is
  genuinely ambiguous whether the note is to be added, and acting on AC-12 would resolve that
  ambiguity the wrong way.

### 2b. The "BLOCKED file passes the gate" P0 is [STATIC-INFERENCE-CONSENSUS] and is over-graded.

AC-1 (P0), P0-2 (P0) and F11 (P2) reach the same conclusion from the same two line ranges:
`SKILL.md:1128-1132` (the three gate checks) and `prompt-templates.md:100-143` (the Phase 3
output skeleton). Nobody ran a blocked reviewer. Three readings of the same lines is
consensus on an interpretation, not independent verification, and under this panel's own rules
that cannot carry a P0.

It is also not a safe inference. I read the gate:

```
1. Existence check — file is present on disk.
2. Minimum-bytes check — file size ≥ 500 bytes. Below this is empirically a stub …
3. Required-headers check — … a Phase 3 review must contain a Score, a Findings section,
   and severity tags.
```

For the P0 to hold, a reviewer that has *just discovered it cannot see the work* must
nevertheless emit ≥500 bytes containing a Score, a Findings section and severity tags. That is
the least likely thing such an agent writes. The far more likely output — a short "BLOCKED: no
Bash, /path/x does not exist" — is under 500 bytes and has no Score, so it **fails checks 2 and
3**, the gate fires, re-dispatch happens, and the design's claimed coverage works as advertised.

The real defect is different and smaller: the design leaves the BLOCKED file's format
completely unspecified (doc:125 says only "still write a state file recording BLOCKED"), so
whether the gate fires is nondeterministic run to run. That is a genuine **P1**, and the fix
AC-1 proposes (a required `**Status: BLOCKED**` marker plus a fourth gate check) is the right
fix. But "would ship a defect" asserts a runtime behaviour nobody observed. F11 got the
epistemics right and the severity too low; P1 is the correct grade.

### 2c. I falsified F2's specific prediction with a live probe.

F2 predicts the push "most likely ships as a silent no-op" because `to:"main"` is annotated
"(background subagents only)" while SKILL.md:743 launches reviewers as blocking parallel Agent
calls. I am one of those blocking parallel Agent reviewers, so I tested it. Verbatim:

```
SendMessage to="main" summary="Review probe: blocking subagent to main" message="REVIEW PROBE …"
→ {"success":true,"message":"Message queued for the main conversation's next turn."}
```

A non-background, blocking parallel Agent subagent is **not rejected** by this recipient. The
"(background subagents only)" annotation does not produce a `success:false` here. F2's
prediction — that reviewers "cannot reach main at all" and every run silently takes the
fallback — is not supported.

What survives, and it is F4's point rather than F2's: `success:true` means *queued*, not
delivered, so this probe does not establish arrival either. The honest statement is that the
call is accepted from a blocking subagent and delivery is unverified in both directions. F2
should be **P2, a documentation gap in the design** (it never mentions the annotation), not a
P0 predicting a no-op.

### 2d. AC-2 and P0-1 argue circularly from the doc's own unmeasured claim.

Both cite design doc:154-155 — "This skill is frequently invoked from inside a subagent or a
workflow" — as if it were established, then use it to size their finding ("the nested shape the
document itself calls frequent"). My DA-1 measured that claim and it does not hold: across
`~/.claude/projects` (156 main-session transcripts, 1837 subagent transcripts, 2026-07-30 to
2026-08-10), three independent markers all return zero for subagents —
`=== SUB: any skill-tool invocation naming agent-review-panel ===` (no output),
`=== SUB: SKILL.md body loaded (heading) === 0`,
`=== SUB: panel state-file convention present === 0` — against 3 / 6 / 8 for main sessions.

Quoting the doc's unmeasured frequency claim back at the doc does not make it evidence. Their
recommendation (probe depth 2 before writing the rule) is right and I support it; the sizing
argument needs to come from SKILL.md:1971-1973 (multi-run may launch orchestrations as parallel
background agents), which establishes the shape is *possible*, not that it is dominant.

### 2e. I disagree with F10's proposed rewrite of the cost ground.

F10 would rewrite doc:157-160 as "the audit shows relay work sits in the 69% orchestrator loop,
so moving it MIGHT help." That overstates the upside. The 69% is not relay work — SKILL.md:1751-
1753 attributes it to "157 turns, each re-reading a context that grew 270k → 630k tokens."
Agent teams do not remove context re-reading; they add full Claude Code sessions alongside it.
My DA-4 rewrite ("Cost effect is unmeasurable without adopting an experimental flag") is the
accurate one. Unmeasurability alone declines the change under this repo's rules; no direction
claim is needed in either direction.

### 2f. Nobody engaged with DA-6, and it is the largest remaining hole in Part 2.

Part 2 imports the failure class from the sibling skill but only its step 5 (treat BLOCKED as
not-clean). The sibling's steps 1-3 — materialize the branch as a worktree, pre-generate the
scoped diff to a file, hand explicit paths plus a no-Bash preamble — are the ones that prevent
the blockage. `grep -n "worktree|gh pr diff|materiali"` across SKILL.md and prompt-templates.md
still returns no pre-staging instruction. And Part 2 only covers the self-aware branch: the
reviewer that *silently reviews the wrong checkout* never sends a BLOCKED message and never
writes a BLOCKED file, so neither the push nor the gate nor the banner sees it. This skill has
a real incident of that class at SKILL.md:198-203. Every mechanism in Part 2 is downstream of
a problem the sibling skill solves upstream.

---

## 3. Updated assessment

**6.5 → 5.5.** My view moved, on evidence, in two directions.

Down, because the doc has more concrete defects than I credited. F1's contract inversion is a
real one I missed entirely — the design writes a rule into a publicly distributed skill that
contradicts the host tool's own description, on an untested premise. F6/P1-5's README gate is a
third CI-breaking omission on top of my two. And the background/blocking distinction is
unaddressed anywhere in the doc.

Up slightly relative to the panel, because the loudest peer P0s do not hold at P0. The
BLOCKED-passes-gate P0 is three readings of two line ranges with no runtime observation and a
plausible path where the gate fires correctly. The silent-no-op P0 is falsified by one probe I
ran in ninety seconds. Two peer findings rest on a quote that exists nowhere in the repository.

The underlying picture is unchanged from round 1 and nothing in the debate moved it: **Part 1
is a real defect fix that needs one probe before its central rule can be written; Part 2 should
not ship in this form**; Part 3's verdict is right and its stated reasons are wrong.

---

## 4. New finding — SendMessage has a third failure shape the design does not model

`DA-13`, P1. Not raised by any reviewer.

Part 1 rule 3 (doc:88-91) enumerates exactly two outcomes: `success: true` and `success: false`,
and routes the latter to the fresh-spawn fallback. There is a third, and it is the one a
reviewer following Part 2's instructions is most likely to hit.

From the SendMessage schema, verbatim:

```json
"summary": {"description": "A 5-10 word summary shown as a one-line preview in the UI
  (required when message is a string). Longer summaries are truncated to 200 characters
  rather than rejected, and only the first line is shown.", "maxLength": 200}
"required": ["to", "message"]
```

My probe, verbatim — `to="__da_probe_nonexistent_agent__"`, a message, no `summary`:

```
<tool_use_error>summary is required when message is a string</tool_use_error>
```

Two things follow, and note the error names `summary`, not the recipient: validation runs
*before* recipient resolution, so this fires on every send with a missing summary, including a
correctly addressed one.

**(a) A `tool_use_error` is neither `success:true` nor `success:false`.** It carries no success
field at all. An orchestrator following rule 3 literally — "Treat any `success: false` as the
trigger for the documented fresh-spawn fallback" — has no rule for it. In the worst reading it
falls through as "not a failure", which is exactly the class rule 3 exists to close. The
distinction matters operationally too: a schema rejection means *fix the call and retry*, not
*the agent is dead, fresh-spawn it* — treating it as an agent failure burns a fresh spawn on a
live, healthy reviewer, at full price against the 69% orchestrator loop.

**(b) Part 2 specifies the invisible field and leaves the visible one unspecified.** Rule 2
(doc:126-128) mandates the form `BLOCKED — <persona name>: <what it could not reach>` in the
message *body*. But `summary` is the field the tool documents as "shown as a one-line preview
in the UI", capped at 200 characters, of which "only the first line is shown". Part 2's entire
purpose is that the orchestrator *notices*. Pinning the body format and saying nothing about
the preview line defeats the mechanism at the only point where a scanning orchestrator looks.

**Recommendation.** Rule 3 must enumerate three outcomes explicitly: `success:true` = accepted
for queueing, not delivered, state file remains the authority; `success:false` = delivery
failure, fresh-spawn fallback; `tool_use_error` = malformed call, correct and retry, do **not**
consume the retry budget or spawn a replacement. Part 2 rule 2 must specify
`summary: "BLOCKED — <persona slug>"` alongside the body form.

This probe also independently corroborates F7: SendMessage appeared in my deferred-tool list
and I had to load it with `ToolSearch query="select:SendMessage,…"` before any call would run.

---

## 5. Falsification check

**P0s I am keeping: one.**

**DA-1** — Part 3's lead decline ground ("frequently invoked from inside a subagent") is an
unmeasured claim recorded in a durable decision document, carrying a reversal condition that
therefore cannot be evaluated.

- *Single falsifying observation:* any subagent transcript that loaded the panel SKILL.md body
  or invoked the panel skill tool.
- *Cheap?* Yes — one grep over `~/.claude/projects`. **I ran it.** 0 of 1837 subagent
  transcripts, three independent markers, all zero. It is not an unrun cheap check.
- *Honest limitation:* one machine, ~12-day retention. But the finding does not require
  "nesting never happens" — it requires only that the doc cites no measurement for a load-
  bearing frequency claim, which is falsifiable solely by the doc producing one. It does not.
  P0 stands.

**P0s I am declining to promote, per the cheap-unrun-check rule:**

- **F1 (contract inversion).** The read-only half is verified and decisive on wording: the
  tool description contradicts the proposed rule, so the unconditional "never the persona
  name" must not ship. The stronger claim — that names *do* work for Agent-tool subagents —
  needs one spawn-with-name plus one send-by-name. Nobody has run it; I have no spawn tool.
  **Cap at P1. Becomes P0 the moment that probe shows a `name` parameter.**
- **F2 (silent no-op).** Falsified in the direction that matters, by my probe in §2c: a
  blocking subagent's send to `"main"` returns `success:true`. **P2.**
- **AC-1 / P0-2 (BLOCKED passes the gate).** Static-inference consensus, no runtime
  observation, and a plausible path where the gate fires correctly (§2b). Falsified by
  producing one real BLOCKED state file and checking its byte count and headers — cheap, and
  unrun. **Cap at P1.**

## 6. Shared-artifact check

**[STATIC-INFERENCE-CONSENSUS] — "a BLOCKED state file passes Phase 13.5."** AC-1, P0-2 and F11
each derive this from `SKILL.md:1128-1132` plus `prompt-templates.md:100-143`. Same lines, same
inference, three readers, zero observations. Tagged, and capped at P1 per §5.

**[STATIC-INFERENCE-CONSENSUS] — "Part 2 breaks in the nested shape."** AC-2, P0-1 and my own
DA-2 all derive this from `SKILL.md:1765-1770` plus design doc:154-155. Only DA-2 has an
independent measurement attached, and that measurement points the *opposite* way on frequency
(§2d). Tagged; the recommendation (probe depth 2) is sound, the sizing is not. P1, not P0.

**Not consensus-tagged:** "cheap orchestrator" inverts the audit (DA-4, F10, AC-F10). Three of
us reached it, but by direct quote comparison against
`docs/analysis/2026-07-16-panel-token-split-audit.md:17` and `:21`, not by inference. Direct
textual contradiction is verification, not interpretation. Stands at P1.
