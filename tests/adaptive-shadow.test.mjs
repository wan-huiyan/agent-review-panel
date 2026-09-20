import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decideAdaptiveShadow, deterministicPersonaSelection, verificationFloor } from "../scripts/adaptive-orchestrator.mjs";

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
    assert.equal(r.judge_needed, false);
  });

  it("uses debate-not-needed only when no material dispute remains", () => {
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P2", claim_type:"local-fact", disputed:false,
      reviewers:["A"], evidence_sources:["src/a.ts"], verified:true
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
    const r = decideAdaptiveShadow({...base, findings:[{
      id:"F1", severity:"P1", claim_type:"cross-file", disputed:false,
      reviewers:["A","B","C"], evidence_sources:["same-file.ts"]
    }]});
    assert.equal(r.finding_decisions[0].independent_evidence, 1);
    assert.equal(r.finding_decisions[0].action, "VERIFY_FIRST");
  });

  it("rejects malformed finding state rather than guessing", () => {
    assert.throws(() => decideAdaptiveShadow({...base, findings:[{id:"F1", claim_type:"magic"}]}), /unknown claim_type/);
  });
});
