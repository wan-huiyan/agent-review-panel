# Adaptive v4 shadow runbook

The shadow runner is deliberately boring: it consumes a **small structured private JSON file**
and prints what adaptive v4 would do. It launches no reviewers, performs no Jev/API calls,
writes no review files, and changes no current v3.9.1 behavior.

## Run

Keep the input outside the repository:

```sh
umask 077
npm run --silent shadow:adaptive -- /private/path/adaptive-input.json > /private/path/adaptive-decision.json
```

`--silent` is required, not cosmetic. Without it npm prints its own two-line banner to stdout
ahead of the script's output, the redirect captures it, and the resulting file is not valid JSON
(`SyntaxError: Unexpected token '>'`). The same applies to the replay and compare commands below.
Calling `node scripts/adaptive-shadow.mjs <input> > out.json` directly works too.

Example schema:

```json
{
  "content_type": "code",
  "signals": ["security"],
  "candidate_personas": [
    "Correctness Hawk",
    "Architecture Critic",
    "Security Auditor",
    "Devil's Advocate"
  ],
  "explicit_personas": [],
  "explicit_mode": "adaptive",
  "high_stakes": false,
  "uncertainty_high": false,
  "material_recommendation_unresolved": false,
  "findings": [
    {
      "id": "F1",
      "severity": "P1",
      "claim_type": "local-fact",
      "disputed": true,
      "reviewers": ["Correctness Hawk", "Security Auditor"],
      "evidence_sources": ["src/auth.ts"],
      "verified": false
    }
  ]
}
```

Claim types are intentionally small:
- `local-fact` — direct single-source read/grep/constant check;
- `cross-file` — static behavior requires following multiple files;
- `external` — third-party/platform/regulatory fact;
- `runtime` — deployed/live state;
- `judgment` — architecture/product/trade-off disagreement;
- `unknown` — insufficient classification.

## Interpret output

`executes_panel=false` and `authorizes_execution=false` are invariants.

Debate decisions:
- `DEBATE_NOT_NEEDED` — no material unresolved disagreement in supplied state;
- `VERIFY_FIRST` — direct evidence should be obtained before rhetoric;
- `DEBATE_ONE_ROUND` — a judgment/trade-off remains;
- `ESCALATE_FULL` — explicit full request or high-impact/high-uncertainty unresolved work;
- `UNAVAILABLE` — debate candidate exists but execution shape cannot debate.

The output is a **counterfactual proposal**. It does not say that the current run should actually
skip phases. During shadow evaluation, continue the existing v3.9.1 run and compare the real
outcome with this proposal afterward.

## What to record from the real run

For each shadow case, separately capture:
- source/repository revision;
- actual v3.9.1 mode;
- actual reviewers and models;
- debate rounds;
- verification agents/tiers;
- judge calls;
- actual input/output/cached tokens if the host exposes them;
- wall-clock duration;
- final P0/P1 findings and verification outcomes;
- whether the owner found the result useful;
- whether the shadow decision would have omitted a material finding.

Do not put private source text into a public fixture. The shadow input needs compact metadata,
not the reviewed code/document itself.

## Current limitations

This first implementation is deterministic only. It intentionally does **not**:
- call Jev;
- parse v3.9.1 state files automatically;
- choose truth/severity;
- launch or message persistent agents;
- alter reports;
- estimate token savings.

Those are separate reviewable slices. The next useful implementation after this shadow state
machine is a read-only extractor that converts existing panel state files into this compact
schema, followed by historical replay. Only after that should the optional shared Jev adapter
be added.

Historical replay command:

```sh
npm run --silent replay:adaptive -- docs/reviews > /private/path/adaptive-history-replay.json
```

Archived runs that lack Phase 3 state fall back to the earliest available Phase 5 round-1 files and are explicitly marked as such; those cases cannot answer what adaptive would have done *before* debate with the same evidentiary strength as a complete Phase 3 archive.

### Sample size, stated plainly

`docs/reviews/` currently holds **two** archived runs:

| Run | Earliest state | Round 2? | Judge? |
|---|---|---|---|
| `2026-05-14-readme` | Phase 3 (4 reviewers) | no | yes |
| `2026-08-10-peer-messaging-design` | Phase 5 round 1 | yes | yes |

So replay has n=2, and the question the comparison scorer exists to inform — *did a second debate
round add anything?* — has **n=1**, because only one archived run has a round 2. Nothing in this
harness can answer that question at n=1. Treat every replay and comparison output as a way to
pick cases for the later controlled A/B trial, never as evidence about debate value. Growing this
corpus is a prerequisite for the evaluation, not a nice-to-have.

## Compare historical later rounds

After replay, inspect whether later archived debate introduced candidate information that is not
obviously present in round 1:

```sh
npm run --silent compare:adaptive-history -- docs/reviews > /private/path/adaptive-history-comparison.json
```

The scorer is intentionally conservative. It reports lexical candidate novelty, severity changes,
and where judge-carried findings appear to be first visible. It always emits
`counterfactual_claim: false`. A quiet round 2 is **not proof** that adaptive could have skipped it;
a novel round-2 candidate is evidence against casually declaring that round redundant. Use these
results to select cases for the later controlled A/B trial, not to estimate savings directly.
