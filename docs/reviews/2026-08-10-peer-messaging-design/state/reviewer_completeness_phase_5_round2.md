# Phase 5 — Debate Round 2 — Completeness Checker / Fresh Reader

**Score: 5/10** (was 6/10)
**Confidence: High** on the new finding and on the citation checks; Medium on the invocation-shape material.
**Agreement intensity: 40%**

---

## 1. Points of agreement — what I now accept, and what convinced me

### AC-5 (Architecture Critic): the persona → agentId map key collides *within* a run. I was wrong.

My round-1 P2-12 said "Map collision is genuinely a non-issue: state is namespaced at
SKILL.md:2095-2097 and design doc:84 makes the map per-run." That reasoning covers collision
*across* runs and I stand by it. It does not cover Run 3, where three Devil's Advocates run
concurrently **inside one run**.

Verified: `skills/agent-review-panel/SKILL.md:1951` —
`| 3 | Adversarial-heavy: 3 Devil's Advocates (different reasoning strategies) + 1 Correctness Hawk |`
and SKILL.md:1954-1957 enumerates the three strategies (analogical, adversarial simulation,
failure-mode enumeration). A map keyed on the persona name holds one entry for three live agents.

AC-5's remedy (key the map on the same per-instance slug the state filenames already use) is better
than my P2-12 remedy (add a run number to the BLOCKED message), because it fixes the map and the
message with one key and removes the chance of the two drifting apart. **I withdraw P2-12's remedy
and adopt AC-5's**, keeping only my narrower point that the BLOCKED message form must carry whatever
key the map uses.

### DA-9 (Devil's Advocate): total Phase 5 loss is NO-DEBATE, not COMPRESSED. I missed this.

Design doc rule 4 (lines 92-95) names only `COMPRESSED RUN`. Verified in the gate text I read in
full: SKILL.md:1158-1168 — "**If the count is ZERO when mode = full panel** (the entire debate phase
is absent, not just one reviewer's file), this is the **NO-DEBATE** condition. Do NOT proceed to
Phase 14 silently." SKILL.md:1169-1171 confirms the split: "Individual missing round-1 files for
*some* reviewers remain a per-file COMPRESSED case."

So if every Phase 5 send fails and every fresh-spawn fallback also fails, zero round-1 files exist
and the correct banner is NO-DEBATE with a Medium confidence cap — a *different* banner, stacked
first. Rule 4 as written would have the implementer reach for the wrong one. This is a genuine
completeness gap adjacent to my P0-2 but distinct from it, and DA-9 found it and I did not.

### F7 (Correctness Hawk): SendMessage is a deferred tool. Reproduced in my own session.

I had to call `ToolSearch query="select:SendMessage,TaskStop,TaskCreate"` before any schema was
available; SendMessage appears in this session's deferred-tool list with the standing note that
"calling them directly will fail with InputValidationError". Part 2 rule 1 tells a blocked reviewer
to send to `"main"` "immediately, before doing anything else" (design doc:123-125). A reviewer that
scans its tool list, sees no SendMessage, and concludes the channel is unavailable takes Part 2's own
rule-4 fallback — which, per my P0-2, is not detected. Both mitigations fail together. F7 is right
and it compounds my P0-2 rather than duplicating it.

### F2's two premises verified byte-for-byte, and I can strengthen the evidence.

I loaded the SendMessage schema myself. Verbatim from the tool description:

```
| `"main"` | The main conversation (background subagents only) |
```

and SKILL.md:743 is `Launch ALL reviewer agents **in parallel** using Agent tool with
`model: "opus"`.` — no background flag, and Part 2's edit-site table (design doc:138-142) changes
nothing about it.

I can add what F2 could not measure. Across the whole transcript corpus on this machine I parsed
**249 real `Agent` tool_use records**; the observed parameter keys are
`{subagent_type: 228, description: 249, run_in_background: 170, prompt: 249, model: 134,
isolation: 4}`, and **41 of 249 set `run_in_background: true`**. So background spawns are a real,
routinely-used shape, and the shape F2 worries about is not hypothetical. I agree the doc must state
which shape its own probe used. I disagree on severity — see §2.

---

## 2. Points of disagreement — verified before contesting

### AC-4 and AC-12 rest on a citation that does not exist in the repo. [FABRICATED CITATION]

AC-4 quotes verbatim, attributed to `SKILL.md:1790-1793`:

> "a send into a session whose permission mode differs from the sender's returns `success: true`
> with a message id while the message is silently held for an approval dialog that a headless
> session never shows (measured 2026-08-10, Claude Code 2.1.226)"

AC-12 then says "The note already exists, complete with the 2026-08-10 measurement, at
skills/agent-review-panel/SKILL.md:1786-1794" and recommends marking Part 3's cross-session note
**done**.

Verbatim command and output:

```
$ grep -n "permission mode\|approval dialog\|crossSessionInbound\|cross-session\|2.1.226" \
    skills/agent-review-panel/SKILL.md
NO MATCH in SKILL.md
$ wc -l skills/agent-review-panel/SKILL.md
    2164 skills/agent-review-panel/SKILL.md
```

And the cited lines actually read:

```
1786: 7. **Read state files only for orchestrator logic** — the orchestrator opens
...
1790:    next agent can read from disk itself.
1791:
1792: ## Budget Mode (v3.7.0)
```

The idea AC-4 paraphrases lives in the **design doc** at line 176 ("an unanswered approval dialog
drops the message after five minutes"), not in SKILL.md. The consequences differ by finding:

- **AC-4's recommendation is good and I endorse it** — say plainly that `success: false` is a
  definite failure while `success: true` is acceptance, not proof of delivery. But its P1 force came
  entirely from "the skill already records a measured counter-example," and it does not. Downgrade
  to P2 and re-ground it on SKILL.md:1767-1770, which already names the state files as the reliable
  signal.
- **AC-12 must be withdrawn outright.** It instructs the implementer to mark as already-shipped a
  paragraph that has not shipped. Acting on it would leave Part 3's only concrete deliverable
  unbuilt while the doc records it as done — a silent gap, in the section explicitly written "so
  this is not re-litigated."

### AC-7's correction to the design doc's line range is itself wrong.

AC-7: "the doc gives '§ ~1748-1791' but the section runs to SKILL.md:1799 — an implementer working
from that range would miss rule 7."

Verified:

```
$ grep -n "^## " skills/agent-review-panel/SKILL.md | awk -F: '$1>1700 && $1<1810'
1748:## Orchestrator Efficiency Discipline (v3.8.0 — all modes)
1792:## Budget Mode (v3.7.0)
```

Rule 7 ends at line 1790; the section is 1748-1791. The **design doc's range was correct** and
AC-7's "correction" would push an implementer 8 lines past the section boundary into Budget Mode.
AC-7's other four missing-edit-site items stand; this sub-claim should be dropped.

### F5 overstates "the error string carries no information about address-form validity."

F5 got a byte-identical error for four address forms and concluded the error cannot discriminate.
The corpus shows it does. Two distinct errors, both verbatim from transcript `toolUseResult`:

```
2026-08-10T17:19:09Z  to='fake-stale-fix'
  -> {'success': False, 'message': "'fake-stale-fix' is not an agent in this conversation.
      Re-send with the ref to confirm you mean:\n  fake-stale-fix [bc7d6c] — Claude session,
      on this machine..."}

2026-08-10T17:37:06Z  to='zzz-no-such-peer-xyz'
  -> {'success': False, 'message': "No agent named 'zzz-no-such-peer-xyz' is reachable.\n
      Use ListAgents to see everyone you can message."}
```

F5's four probes were all names with no matching peer, so they collapsed to the second form. The
paired-control recommendation remains right; the inference that the error is uninformative is not,
and it matters because F5 uses it to argue the doc's table rows 2 and 3 lack discriminating power.

### F1: correct in substance, but the evidence now tilts the doc's way. Cap at P1.

F1's two verbatim quotes are accurate — I reproduced both from the loaded schemas. SendMessage:
"Refer to agents by name … Use the raw `agentId` … only when the agent has no name". TaskStop: "To
stop a background agent spawned with a name, pass that name as task_id".

F1 asked for a probe of the spawn call's `name` parameter and noted neither of us has the spawn
tool. I ran the read-only equivalent across every `Agent` spawn on this machine: **249 spawns, zero
with a `name` key** (full key census above). That is not proof the schema lacks `name` — but it is
the strongest evidence available, it points toward the doc's premise rather than against it, and F1
promoted a P0 on the opposite inference without it. By the falsification standard F1 should hold
itself to, an unrun probe caps the finding at P1.

F1's *narrowed* recommendation is the right one and I support it: write "the Agent tool's
`description` is not an address" rather than the unqualified "never the persona name", because
§4 below shows a third address form that "agentId only" gets wrong.

### F2 / AC-2 / DA-2 / my own P0-1: all four are the same two lines. Downgrade to P1.

[STATIC-INFERENCE-CONSENSUS] Four reviewers reached "the push may not work" from exactly two static
texts — the SendMessage `"main"` row and SKILL.md:1765-1770's nested caveat. That is one
interpretation held four times, not four verifications, and the panel should not let the count
create confidence.

Against it: the doc's own probe row 4 records a subagent→main send that **worked**. The doc simply
never says what shape that subagent was. I searched every `SendMessage` in the corpus: exactly two
sends used `to="main"`, both from `/subagents/` transcripts (2026-08-10T17:36:25Z and 17:56:44Z), and
I could not recover their spawn flags — the parent session's transcript is not on disk yet.

So the honest finding is **"the doc omits the spawn shape of its own probe"** — a one-line evidence
gap, P1 — not "the feature ships as a no-op", which is P0 and which nobody has observed. **I am
downgrading my own P0-1 to P1 on the same reasoning**, and I think F2 and AC-2 should follow.

### DA-1: the headline reproduces exactly; one corroborating number does not.

I reproduced DA-1's primary marker independently:

```
$ grep -rl '"skill":"roundtable:agent-review-panel"' ~/.claude/projects
MAIN: 3      SUBAGENT: 0
  -Users-huiyan-Documents-DoodleRun/2a527bc5-....jsonl
  -Users-huiyan-Documents-wickes/8beaf90c-....jsonl
  -Users-huiyan-Documents-barryu-application-propensity/6e9cea27-....jsonl
corpus: 156 main .jsonl, 1847 subagent .jsonl
```

Same count, same three files. But DA-1's second marker reported "SKILL.md body loaded (heading):
MAIN 6 / SUB 0". Using the heading `Orchestrator Efficiency Discipline (v3.8.0` I get **MAIN 6 /
SUB 17**. The 17 are plausibly this panel's own reviewers reading SKILL.md — which is precisely why
a "body loaded" marker cannot separate *reading* the file from *invoking* the skill. DA-1's
conclusion survives on the primary marker; that second number should be dropped rather than
defended, or the panel inherits an unreproducible figure.

One refinement DA-1 gestured at but did not draw out, and it is the stronger form of the argument:
the skill is **distributed publicly** — the doc says so itself at line 177. One machine's ~12-day
corpus cannot measure the invocation shape of a public skill *in principle*. So the fix is not
"correct the frequency number", it is **delete the frequency claim** and keep the ground as a shape
the skill must tolerate. That decline is sufficient without any frequency claim at all, and it
removes the unevaluable reversal condition as a side effect.

---

## 3. Updated assessment

**6 → 5.** Down, on balance:

- Down, decisively, for §4: section 2 is titled "What we verified" and one of its five rows is
  false, and Part 3 defers an entire feature on that row while explicitly freezing the decision
  against re-litigation.
- Down for DA-9 and AC-5, two real completeness gaps I missed in round 1.
- Up slightly, because two peer P0s (F1, F2) are weaker than claimed and AC-4/AC-12 are unsupported
  by the repo. The document has fewer *shipped-defect* problems than round 1's raw P0 count implies
  — but more *false-claim* problems, and in this repo those are the same severity.

My P0-2 (a conforming BLOCKED state file passes the Phase 13.5 gate, so no COMPRESSED banner fires
and the blocked reviewer still reads as clean) survives round 1 untouched and I hold it at P0. I
re-read the full gate this round to be sure: SKILL.md:1126-1134 defines exactly three checks
(existence, ≥500 bytes, required headers); SKILL.md:1297-1299 emits COMPRESSED only "If the Phase
13.5 verification gate detected any unrecoverable missing phase output"; SKILL.md:1314-1315 confirms
"For full runs, the warning block is absent. Its absence is the green-light signal." AC-1 reached
the same conclusion from the same lines, so it is tagged below — but unlike the push findings, this
one is a pure text-level entailment that a read-only command settles, and I ran it.

---

## 4. New finding — `ListAgents` exists and works; cross-session messaging is verified end-to-end

**Design doc line 41 is false, and Part 3's cross-session deferral rests entirely on it.**

The row reads:

```
| `ListAgents`, in the main session and inside a subagent | **does not exist** in this environment |
```

and Part 3 (lines 172-178) opens: "`ListAgents` does not exist in this environment, so nothing here
is verifiable today."

From the transcript corpus on this machine, all read-only:

**(a) 22 `ListAgents` invocations, every one with `is_error = None`, all returning real payloads.**
Verbatim results:

```
2026-08-10T17:16:34Z  Peer sessions (5):
    resume-gate-port [414783]  ·  interactive  ·  busy  ·  started 51m ago
    Documents [235ebf]  ·  interactive  ·  idle  ·  started 7h ago
    event-attandence [735f9b]  ·  interactive  ·  busy  ·  started 1h ago  ...

2026-08-10T16:00:23Z  Subagents (4):
    a0b6443627a28a8b4  ·  general-purpose  ·  running  ·  started 7m ago
    ac0c9a547994d952a  ·  general-purpose  ·  running  ·  started 7m ago  ...
```

**(b) Called from both halves of the row the doc denies.** Main sessions: 8 calls in
`…-learning-traffic/53160daf-….jsonl`, 4 in `…-barryu-application-propensity/76020d78-….jsonl`, and
others. Subagents: 2 calls in `…/subagents/agent-a0b6443627a28a8b4.jsonl` and 1 in
`…/subagents/workflows/wf_de629049-114/agent-a33ae5493de458b43.jsonl`.

**(c) The likely origin of the error.** One call returned `No reachable agents.`
(2026-08-07T09:02:35Z) — a **successful call with an empty result**, not a missing tool. That is
almost certainly what was probed and recorded as "does not exist".

**(d) Cross-session messaging is verified end-to-end, with a two-step disambiguation protocol nobody
in this panel has documented.** Verbatim, from `toolUseResult`:

```
17:40:39Z  to='arp-probe-a'
  -> {'success': False, 'message': "'arp-probe-a' is not an agent in this conversation.
      Re-send with the ref to confirm you mean:  arp-probe-a [0e3383] — Claude session, on this machine"}
17:40:41Z  to='arp-probe-a [0e3383]'
  -> {'success': True, 'message': '"probe ping" → arp-probe-a (another Claude session on this machine)',
      'msg_id': '464d5680-a955-4273-8f59-304eb7a8e8f4'}
```

The same bare-name-fails → `name [ref]`-succeeds pattern completed successfully for
`arp-probe-e [ca027a]`, `arp-probe-g [237f30]`, `arp-probe-j [a86385]`, and `fake-stale-fix [bc7d6c]`
(three sends). Five distinct peer sessions, every second-step send `success: True` with a `msg_id`.

**Why this is P0, not a nit.** Three compounding reasons:

1. Section 2 is the document's entire evidence base and is titled "What we verified". A false row
   there is the exact defect class this repo treats as most serious — and the doc's own framing
   ("Probed directly … rather than relying on documentation", line 32-33) claims a higher standard
   than it met.
2. Part 3 is written "Recorded so this is not re-litigated" (line 146). Shipping it freezes the
   error into the repo's decision record, and the deferral's stated reason evaporates on inspection.
   The feature may still be worth deferring — the doc's *other* grounds (plain text only,
   `crossSessionInbound` policy, macOS/Linux only, public distribution) are untouched by this — but
   the load-bearing sentence is wrong.
3. It reaches back into **Part 1**. The corpus reveals a **third address form** — `name [ref]` — that
   "address by agentId only, never the persona name" (rule 2, lines 85-87) does not describe. The
   bare-name failure mode here is not "unreachable"; it is "ambiguous, confirm which one you mean",
   which is *precisely* the misrouting-safety problem Part 1 exists to solve, arriving with a
   built-in disambiguation handshake the rule ignores.

**Honest caveat.** The probe timestamps (17:19–17:48 on 2026-08-10) may postdate the writing of the
design doc, which is also dated 2026-08-10. If so, the row was honest when written and is now stale.
That changes who is at fault and nothing about whether it can ship.

**Recommendation.** Re-probe `ListAgents` from a main session and rewrite row 5 to what is observed,
distinguishing "not exposed to the panel's *subagents* in this harness" (which my own
`ToolSearch select:ListAgents` → "No matching deferred tools found" supports) from "does not exist"
(which is false). Rewrite Part 3's cross-session paragraph to defer on the grounds that survive.
Add the `name [ref]` form to Part 1's addressing rule, or state explicitly that it applies only to
peer sessions and not to Agent-tool subagents.

---

## 5. Falsification check — every P0 I promote or keep

| P0 | Single observation that would prove it wrong | Cheap? | Ruling |
|---|---|---|---|
| **NEW — `ListAgents` claim is false** | One `ListAgents` call from a main session on this machine returning a tool-not-found error | Cheap for the orchestrator; **not available to me** (`ToolSearch select:ListAgents` → "No matching deferred tools found") | **KEEP P0.** The rule caps a P0 when the confirming observation has *not been made*. Here it has: 22 recorded invocations with payloads and `is_error = None` are direct observations of the tool working, not inferences. The burden has flipped to whoever wants to keep the row. |
| **P0-2 — a conforming BLOCKED file passes the Phase 13.5 gate** | A fourth Phase 13.5 check, or a Phase 15.1 COMPRESSED trigger keyed on file *content* rather than on gate failure | Cheap — and I ran it | **KEEP P0.** I read the complete gate (SKILL.md:1105-1200) and the complete Phase 15.1 compressed block (SKILL.md:1295-1315). Three checks only; emission conditioned strictly on gate failure; absence is the green light. Pure text entailment, fully verified. |
| **P0-1 — nested-orchestrator push misroutes** | One probe: reviewer under a nested orchestrator → `"main"` | Cheap, and **nobody has run it, including me** | **DOWNGRADE to P1** per the rule. Same downgrade should apply to F2, AC-2 and DA-2, which are the same unrun probe. |

---

## 6. Shared-artifact check

- **[STATIC-INFERENCE-CONSENSUS] P0-2 + AC-1** — both from SKILL.md:1126-1134, :1297-1300,
  :1314-1315. One interpretation held twice. Kept at P0 *only* because it is a text entailment I
  verified by reading the full sections, not because two reviewers concur.
- **[STATIC-INFERENCE-CONSENSUS] P0-1 + AC-2 + DA-2 + F2** — four reviewers, two source lines
  (SendMessage's `"main"` row; SKILL.md:1765-1770), zero probes. The clearest case this round of
  agreement being mistaken for evidence. All four downgraded to P1 on my account.
- **[STATIC-INFERENCE-CONSENSUS] version-bump omission — P1-4 + F6 + AC-9 + DA-10** — same greps
  over the same four files. Correctly P1, but it is **one** finding, not four, and should be
  reported once so the count does not inflate the doc's apparent defect density.
- **[STATIC-INFERENCE-CONSENSUS] "cheap orchestrator" inverts the audit — F10 + DA-4** — same two
  audit lines. I verified them: `docs/analysis/2026-07-16-panel-token-split-audit.md:17`
  (`| **Main session (orchestrator)** | **$111.49** | **69%** |`) and `:21`
  (`| 4 reviewers, Phases 3–7 | $11.86 | 7% |`). Correct, and correctly P2.
- **NOT shared** — §4 comes from the transcript corpus, which no other reviewer opened for this
  purpose (the Devil's Advocate opened it only to count invocation shapes). It is the one
  independent artifact introduced this round.
