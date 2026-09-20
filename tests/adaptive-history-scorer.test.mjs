import { describe,it } from "node:test";
import assert from "node:assert/strict";
import { compareArchive,parseJudgeFindings } from "../scripts/adaptive-history-scorer.mjs";

describe("adaptive historical comparison scorer",()=>{
 it("parses judge ruling headings conservatively",()=>{
  const x=parseJudgeFindings("# Judge\n### Upheld at P1 — Missing guard\nEvidence.\n### Meta\nOther.");
  assert.equal(x.length,1); assert.equal(x[0].severity,"P1");
 });
 it("flags candidate round-2 novelty without claiming causality",()=>{
  const x=compareArchive({
   round1Findings:[{title:"Missing guard",severity:"P1",phase:"round1"}],
   round2Findings:[{title:"New routing failure",severity:"P1",phase:"round2"}],
   judgeFindings:[{title:"Upheld P1 routing failure",severity:"P1",text:"new routing failure"}],
   shadow:{debate_decision:"DEBATE_ONE_ROUND"}
  });
  assert.equal(x.counterfactual_claim,false);
  assert.ok(x.historical.round2_novel_candidate_count>=1);
  assert.match(x.interpretation,/do not treat it as redundant/);
 });
 it("does not call a quiet second round proof of redundancy",()=>{
  const x=compareArchive({
   round1Findings:[{title:"Missing guard",severity:"P1",phase:"round1"}],
   round2Findings:[{title:"Missing guard",severity:"P1",phase:"round2"}],
   judgeFindings:[{title:"Missing guard",severity:"P1",text:"Missing guard"}],
   shadow:{debate_decision:"DEBATE_ONE_ROUND"}
  });
  assert.equal(x.historical.round2_novel_candidate_count,0);
  assert.match(x.interpretation,/not a proof/);
 });
 it("reports severity changes as information candidates",()=>{
  const x=compareArchive({
   round1Findings:[{title:"Routing issue",severity:"P0",phase:"round1"}],
   round2Findings:[{title:"Routing issue",severity:"P1",phase:"round2"}],
   judgeFindings:[],shadow:{}
  });
  assert.equal(x.historical.round2_severity_change_candidate_count,1);
 });
});
