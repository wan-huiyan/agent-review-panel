import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { POLICY_VERSION, classifyFinding, decideAdaptiveShadow, deterministicPersonaSelection, verificationFloor } from "../scripts/adaptive-orchestrator.mjs";

const base = {
  content_type: "code",
  signals: [],
  candidate_personas: ["Correctness Hawk", "Architecture Critic", "Security Auditor", "Devil's Advocate"],
  explicit_personas: [],
  findings: []
};

describe("adaptive shadow state machine", () => {
  it("does not execute or authorize anything", () => {
    const r = decideAdaptiveShadow(base);
    assert.equal(r.mode, "shadow");
    assert.equal(r.executes_panel, false);
    assert.equal(r.authorizes_execution, false);
    assert.equal(r.provider.status, "not_requested");
  });

  it("selects a compact differentiated default set", () => {
    const p = deterministicPersonaSelection(base);
    assert.ok(p.length >= 2 && p.length <= 3);
    assert.ok(p.includes("Correctness Hawk"));
    assert.ok(p.includes("Architecture Critic"));
  });

  it("preserves every explicit persona even above target size", () => {
    const p = deterministicPersonaSelection({...base, explicit_personas: ["A","B","C","D"]});
    assert.deepEqual(p.slice(0,4), ["A","B","C","D"]);
  });

  it("adds security specialist on signal when capacity exists", () => {
    const p = deterministicPersonaSelection({...base, signals:["security"]});
    assert.ok(p.includes("Security Auditor"));
  });

  it("routes cheap factual disputes to verification before debate", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P1", claim_type:"local-fact", disputed:true,
      reviewers:["A","B"], evidence_sources:["src/a.ts"]
    }]});
    assert.equal(r.debate_decision, "VERIFY_FIRST");
    assert.equal(r.report_label, "[DEBATE-DEFERRED-TO-VERIFICATION]");
    // Not false: the verification has not run, so the judge question has no answer yet.
    assert.equal(r.judge_needed, null);
  });

  it("uses debate-not-needed only when no material dispute remains", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P2", claim_type:"local-fact", disputed:false,
      reviewers:["A"], evidence_sources:["src/a.ts"], verified:true, verification_method:"grep"
    }]});
    assert.equal(r.debate_decision, "DEBATE_NOT_NEEDED");
    assert.equal(r.report_label, "[DEBATE-NOT-NEEDED]");
  });

  it("routes judgment disputes to one debate round", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P1", claim_type:"judgment", disputed:true,
      reviewers:["A","B"], evidence_sources:["plan.md"]
    }]});
    assert.equal(r.debate_decision, "DEBATE_ONE_ROUND");
    assert.equal(r.full_escalation, false);
  });

  it("keeps unavailable debate distinct from deliberate skip", () => {
    const r = decideAdaptiveShadow({...base, debate_unavailable:true, findings:[{
      id:"F1", severity:"P1", claim_type:"judgment", disputed:true,
      reviewers:["A","B"], evidence_sources:["plan.md"]
    }]});
    assert.equal(r.debate_decision, "UNAVAILABLE");
    assert.equal(r.report_label, "[NO-DEBATE]");
    // D1: the branch that reports an unavailable mechanism must not also report no judge.
    assert.equal(r.judge_needed, true);
    assert.equal(r.debate_mechanism_unavailable, true);
  });

  it("explicit full request cannot be downgraded", () => {
    const r = decideAdaptiveShadow({...base, explicit_mode:"full"});
    assert.equal(r.full_escalation, true);
    assert.equal(r.debate_decision, "ESCALATE_FULL");
    assert.equal(r.judge_needed, true);
  });

  it("high-impact high-uncertainty unresolved work escalates full", () => {
    const r = decideAdaptiveShadow({...base, high_stakes:true, uncertainty_high:true, findings:[{
      id:"F1", severity:"P0", claim_type:"runtime", disputed:true,
      reviewers:["A","B"], evidence_sources:["deploy.sh"]
    }]});
    assert.equal(r.full_escalation, true);
    assert.equal(r.report_label, "[ESCALATED-FULL]");
  });

  it("runtime and external claims retain deep verification floor", () => {
    assert.equal(verificationFloor({claim_type:"runtime"}), "DEEP");
    assert.equal(verificationFloor({claim_type:"external"}), "DEEP");
    assert.equal(verificationFloor({claim_type:"local-fact"}), "LIGHT");
  });

  it("same-artifact consensus does not become verified", () => {
    // Three reviewers citing one file is one source, so the caller's `verified` flag
    // cannot discharge the STANDARD floor (invariant 6).
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P0", claim_type:"cross-file", disputed:false, verified:true, verification_method:"read",
      reviewers:["A","B","C"], evidence_sources:["same-file.ts"]
    }]});
    assert.equal(r.finding_decisions[0].independent_evidence, 1);
    assert.equal(r.finding_decisions[0].verification_status, "claimed_not_discharged");
    assert.notEqual(r.finding_decisions[0].action, "RESOLVED");
    assert.notEqual(r.report_label, "[DEBATE-NOT-NEEDED]");
  });

  it("rejects malformed finding state rather than guessing", () => {
    assert.throws(() => decideAdaptiveShadow({...base, findings:[{id:"F1", claim_type:"magic"}]}), /unknown claim_type/);
  });
});

const disputedJudgment = {
  id:"F1", severity:"P1", claim_type:"judgment", disputed:true,
  reviewers:["A","B"], evidence_sources:["plan.md"]
};

describe("adaptive shadow escalation record consistency", () => {
  it("still needs a judge when a material dispute outlives the debate mechanism", () => {
    const r = decideAdaptiveShadow({...base, debate_unavailable:true, findings:[disputedJudgment]});
    assert.equal(r.debate_decision, "UNAVAILABLE");
    assert.equal(r.judge_needed, true);
  });

  it("keeps the unavailable mechanism visible when the run escalates instead", () => {
    const r = decideAdaptiveShadow({...base, debate_unavailable:true, high_stakes:true, uncertainty_high:true, findings:[disputedJudgment]});
    assert.equal(r.debate_decision, "ESCALATE_FULL");
    assert.equal(r.report_label, "[ESCALATED-FULL]");
    // The escalated record must not read as a clean handoff to a protocol that can debate.
    assert.equal(r.debate_mechanism_unavailable, true);
    assert.ok(r.reasons.includes("escalation_handoff_cannot_run_debate_mechanism_unavailable"));
  });

  it("does not keep the overridden branch's reason in the record", () => {
    const r = decideAdaptiveShadow({...base, debate_unavailable:true, high_stakes:true, uncertainty_high:true, findings:[disputedJudgment]});
    assert.ok(!r.reasons.includes("material_debate_candidate_but_mechanism_unavailable"));
    assert.ok(r.reasons.includes("high_impact_high_uncertainty_requires_full_escalation"));
  });
});

describe("adaptive shadow judge gate", () => {
  const disputedLiveStateP0 = {
    id:"F1", severity:"P0", claim_type:"runtime", disputed:true,
    reviewers:["A","B"], evidence_sources:["deploy.sh"]
  };

  it("defers the judge question on a disputed high-impact live-state P0 instead of answering no", () => {
    for (const risk of [{high_stakes:true}, {signals:["security"]}]) {
      const r = decideAdaptiveShadow({...base, ...risk, findings:[disputedLiveStateP0]});
      assert.equal(r.debate_decision, "VERIFY_FIRST");
      assert.notEqual(r.judge_needed, false, "an unasked judge question must not read as no judge needed");
      assert.equal(r.judge_needed, null);
      assert.ok(r.reasons.includes("judge_decision_deferred_pending_verification"));
    }
  });

  it("separates no judge needed, judge needed now, and judge question deferred", () => {
    // Nothing unresolved, so "no judge needed" is an answer rather than a placeholder.
    assert.equal(decideAdaptiveShadow(base).judge_needed, false);
    assert.equal(decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P1", claim_type:"local-fact", verified:true, verification_method:"grep", evidence_sources:["a.ts"]
    }]}).judge_needed, false);
    assert.equal(decideAdaptiveShadow({...base, explicit_mode:"full"}).judge_needed, true);
    assert.equal(decideAdaptiveShadow({...base, high_stakes:true, findings:[disputedJudgment]}).judge_needed, true);
    assert.equal(decideAdaptiveShadow({...base, debate_unavailable:true, findings:[disputedJudgment]}).judge_needed, true);
    assert.equal(decideAdaptiveShadow({...base, findings:[disputedJudgment]}).judge_needed, null);
    assert.equal(decideAdaptiveShadow({...base, findings:[disputedLiveStateP0]}).judge_needed, null);
  });

  it("names the pending step that the judge decision waits on", () => {
    const pendingDebate = decideAdaptiveShadow({...base, findings:[disputedJudgment]});
    assert.equal(pendingDebate.debate_decision, "DEBATE_ONE_ROUND");
    assert.ok(pendingDebate.reasons.includes("judge_decision_deferred_pending_debate_round"));
    const pendingVerification = decideAdaptiveShadow({...base, findings:[disputedLiveStateP0]});
    assert.ok(pendingVerification.reasons.includes("judge_decision_deferred_pending_verification"));
    assert.ok(!pendingVerification.reasons.includes("judge_decision_deferred_pending_debate_round"));
  });

  it("does not claim a deferral on a run with nothing pending", () => {
    const r = decideAdaptiveShadow(base);
    assert.ok(!r.reasons.some(x => x.startsWith("judge_decision_deferred")));
  });

  it("keeps a deferred judge question falsy so no caller fires a judge on it", () => {
    assert.ok(!decideAdaptiveShadow({...base, findings:[disputedLiveStateP0]}).judge_needed);
  });
});

describe("adaptive shadow signal vocabulary", () => {
  const withSignal = signal => decideAdaptiveShadow({...base, signals:[signal], uncertainty_high:true, findings:[disputedJudgment]});

  it("treats the design document's own risk signal spellings as high impact", () => {
    for (const signal of ["security", "auth", "payments", "payment", "data loss", "data-loss", "infrastructure", "infra", "production", "migration", "compliance"]) {
      const r = withSignal(signal);
      assert.equal(r.full_escalation, true, `${signal} should be high impact`);
      assert.deepEqual(r.unrecognised_signals, [], `${signal} should be recognised`);
    }
  });

  it("does not match a risk signal inside an unrelated word", () => {
    const r = decideAdaptiveShadow({...base, content_type:"documentation", signals:["documentation-authoring"], uncertainty_high:true, findings:[disputedJudgment]});
    assert.ok(!r.selected_personas.includes("Security Auditor"));
    assert.equal(r.full_escalation, false);
    assert.deepEqual(r.signal_categories, []);
  });

  it("records an unrecognised signal instead of dropping it", () => {
    const r = decideAdaptiveShadow({...base, signals:["quantum-flux"]});
    assert.deepEqual(r.unrecognised_signals, ["quantum-flux"]);
    assert.ok(r.reasons.includes("unrecognised_signal_recorded_not_classified"));
  });

  it("decides the same way whatever order signals arrive in", () => {
    const a = decideAdaptiveShadow({...base, signals:["security","payments"]});
    const b = decideAdaptiveShadow({...base, signals:["payments","security"]});
    assert.deepEqual(a, b);
  });
});

describe("adaptive shadow explicit floors", () => {
  it("throws on an unknown explicit mode instead of degrading to adaptive", () => {
    for (const mode of ["exhaustive-trace", "deep research", "multi-run", "gibberish"]) {
      assert.throws(() => decideAdaptiveShadow({...base, explicit_mode:mode}), /unknown explicit_mode/);
    }
  });

  it("treats each named review modifier as its own floor", () => {
    for (const field of ["explicit_exhaustive_trace", "explicit_deep_research", "explicit_multi_run", "explicit_full_panel"]) {
      const r = decideAdaptiveShadow({...base, [field]:true, findings:[disputedJudgment]});
      assert.equal(r.full_escalation, true, `${field} should be a floor`);
      assert.equal(r.judge_needed, true, `${field} should require adjudication`);
      assert.ok(r.explicit_floors.includes(field), `${field} should be named in the record`);
    }
  });

  it("names the floor that escalated rather than claiming an unrequested full-panel request", () => {
    const r = decideAdaptiveShadow({...base, explicit_deep_research:true, findings:[disputedJudgment]});
    assert.ok(r.reasons.includes("explicit_modifier_floor_requires_full_protocol_handoff"));
    assert.ok(!r.reasons.includes("explicit_full_request_is_authoritative_floor"));
  });
});

describe("adaptive shadow input validation", () => {
  it("throws on a severity outside the closed set", () => {
    for (const severity of ["p0", "P0 ", "critical", "Blocker", 0, "P4"]) {
      assert.throws(() => decideAdaptiveShadow({...base, findings:[{
        id:"F1", severity, claim_type:"runtime", disputed:false, evidence_sources:["a.ts"]
      }]}), /unknown severity/, `severity ${JSON.stringify(severity)} should be rejected`);
    }
  });

  it("routes an omitted severity as material rather than as cheap", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", claim_type:"runtime", disputed:false, reviewers:["A"], evidence_sources:["a.ts"]
    }]});
    assert.equal(r.finding_decisions[0].severity, "unknown");
    assert.equal(r.finding_decisions[0].action, "VERIFY_FIRST");
    assert.notEqual(r.report_label, "[DEBATE-NOT-NEEDED]");
  });

  it("rejects a non-boolean in a boolean field rather than reading it as false", () => {
    assert.throws(() => decideAdaptiveShadow({...base, high_stakes:"true"}), /high_stakes must be a boolean/);
    assert.throws(() => decideAdaptiveShadow({...base, debate_unavailable:"true"}), /debate_unavailable must be a boolean/);
    assert.throws(() => decideAdaptiveShadow({...base, findings:[{...disputedJudgment, disputed:"true"}]}), /finding.disputed must be a boolean/);
    assert.throws(() => decideAdaptiveShadow({...base, findings:[{...disputedJudgment, verified:1}]}), /finding.verified must be a boolean/);
  });

  it("rejects an explicit null array instead of reading it as empty", () => {
    assert.throws(() => decideAdaptiveShadow({...base, findings:null}), /findings must be an array/);
    assert.throws(() => decideAdaptiveShadow({...base, signals:null}), /signals must be an array/);
    assert.throws(() => decideAdaptiveShadow({...base, findings:[{...disputedJudgment, evidence_sources:null}]}), /evidence_sources must be an array/);
  });

  it("rejects duplicate finding ids", () => {
    assert.throws(() => decideAdaptiveShadow({...base, findings:[
      {...disputedJudgment, id:"F1"},
      {...disputedJudgment, id:"F1", claim_type:"runtime"}
    ]}), /duplicate finding id/);
  });

  it("keeps the unclassified claim path reachable", () => {
    const r = classifyFinding({id:"F1", severity:"P0", disputed:true, evidence_sources:["a.ts"]});
    assert.equal(r.claim_type, "unknown");
    assert.equal(r.action, "VERIFY_OR_DEBATE");
  });
});

describe("adaptive shadow verification floors", () => {
  const verified = extra => classifyFinding({id:"F1", verified:true, disputed:false, ...extra});

  it("does not let a bare verified boolean discharge a floor", () => {
    const r = verified({severity:"P0", claim_type:"runtime", evidence_sources:["a.ts"]});
    assert.equal(r.verification_method, "unknown");
    assert.equal(r.verification_status, "claimed_not_discharged");
    assert.notEqual(r.action, "RESOLVED");
  });

  it("requires two independent sources to discharge standard and deep floors", () => {
    assert.equal(verified({severity:"P0", claim_type:"cross-file", verification_method:"read", evidence_sources:["a.ts"]}).action, "VERIFY_FIRST");
    assert.equal(verified({severity:"P0", claim_type:"cross-file", verification_method:"read", evidence_sources:["a.ts","b.ts"]}).action, "RESOLVED");
    assert.equal(verified({severity:"P1", claim_type:"local-fact", verification_method:"grep", evidence_sources:["a.ts"]}).action, "RESOLVED");
  });

  it("requires live evidence for a live-state claim", () => {
    assert.equal(verified({severity:"P0", claim_type:"runtime", verification_method:"authoritative-source", evidence_sources:["a","b"]}).verification_status, "claimed_not_discharged");
    assert.equal(verified({severity:"P0", claim_type:"runtime", verification_method:"live", evidence_sources:["describe","logs"]}).action, "RESOLVED");
    assert.equal(verified({severity:"P0", claim_type:"external", verification_method:"authoritative-source", evidence_sources:["rfc","vendor"]}).action, "RESOLVED");
  });

  it("does not accept static inference as a discharged check", () => {
    const r = verified({severity:"P1", claim_type:"local-fact", verification_method:"static-inference", evidence_sources:["a.ts"]});
    assert.equal(r.verification_status, "claimed_not_discharged");
  });

  it("keeps a verified finding unresolved while it is still disputed", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P0", claim_type:"runtime", verified:true, verification_method:"live", disputed:true,
      reviewers:["A","B"], evidence_sources:["describe","logs"]
    }]});
    assert.notEqual(r.finding_decisions[0].action, "RESOLVED");
    assert.notEqual(r.debate_decision, "DEBATE_NOT_NEEDED");
    assert.notEqual(r.report_label, "[DEBATE-NOT-NEEDED]");
    // The record must show the discharged check and the surviving dispute together,
    // or "discharged but not resolved" reads as a contradiction.
    assert.equal(r.finding_decisions[0].verification_status, "discharged");
    assert.equal(r.finding_decisions[0].disputed, true);
  });
});

describe("adaptive shadow persona capacity", () => {
  it("does not evict the domain specialist for a caller-named persona", () => {
    const p = deterministicPersonaSelection({...base, signals:["security"], explicit_personas:["Team Lead"]});
    assert.deepEqual(p, ["Team Lead", "Correctness Hawk", "Security Auditor"]);
  });

  it("says so when a specialist is dropped for space", () => {
    const r = decideAdaptiveShadow({...base, signals:["security"], explicit_personas:["A","B","C"]});
    assert.ok(r.reasons.includes("domain_specialist_dropped_for_capacity"));
  });

  it("says so when the candidate pool cannot reach the two-perspective target", () => {
    for (const candidate_personas of [[], ["Solo"]]) {
      const r = decideAdaptiveShadow({...base, candidate_personas});
      assert.ok(r.selected_personas.length < 2);
      assert.ok(r.reasons.includes("persona_target_unmet_candidate_pool_too_thin"));
    }
    assert.ok(!decideAdaptiveShadow(base).reasons.includes("persona_target_unmet_candidate_pool_too_thin"));
  });

  it("says so when a strong signal has no specialist in the pool", () => {
    const r = decideAdaptiveShadow({...base, signals:["data loss"]});
    assert.ok(r.reasons.includes("domain_specialist_absent_from_candidate_pool"));
  });

  it("does not give one perspective two slots on a spelling difference", () => {
    for (const spelling of ["correctness hawk", "Correctness Hawk "]) {
      const p = deterministicPersonaSelection({...base, explicit_personas:[spelling]});
      const keys = p.map(x => x.trim().toLowerCase());
      assert.equal(new Set(keys).size, keys.length, `${spelling} produced a duplicate perspective`);
      assert.equal(p[0], spelling);
    }
  });
});

describe("adaptive shadow record shape", () => {
  it("emits the documented key set under a versioned policy", () => {
    assert.equal(POLICY_VERSION, "adaptive-v4-shadow-3");
    assert.deepEqual(Object.keys(decideAdaptiveShadow(base)), [
      "policy_version", "mode", "executes_panel", "authorizes_execution", "explicit_mode",
      "explicit_floors", "selected_personas", "signal_categories", "unrecognised_signals",
      "finding_decisions", "debate_decision", "debate_mechanism_unavailable", "judge_needed",
      "full_escalation", "report_label", "reasons", "provider", "observed_usage"
    ]);
    assert.deepEqual(Object.keys(decideAdaptiveShadow({...base, findings:[disputedJudgment]}).finding_decisions[0]), [
      "id", "action", "severity", "claim_type", "disputed", "verification_floor",
      "independent_evidence", "verification_method", "verification_status"
    ]);
  });

  it("does not carry finding prose into the record", () => {
    const r = decideAdaptiveShadow({...base, findings:[{...disputedJudgment, title:"private review prose", source_file:"reviewer_a.md"}]});
    assert.ok(!JSON.stringify(r).includes("private review prose"));
  });
});
