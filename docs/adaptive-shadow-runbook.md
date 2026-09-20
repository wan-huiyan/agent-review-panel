# Adaptive v4 shadow runbook

The shadow runner is deliberately boring: it consumes a **small structured private JSON file**
and prints what adaptive v4 would do. It launches no reviewers, performs no Jev/API calls,
writes no review files, and changes no current v3.9.1 behavior.

## Run

Keep the input outside the repository:

```sh
umask 077
npm run shadow:adaptive -- /private/path/adaptive-input.json > /private/path/adaptive-decision.json
```

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
