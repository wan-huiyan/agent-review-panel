import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const design = readFileSync(resolve(ROOT, "docs/adaptive-review-v4-design.md"), "utf8");
const contract = readFileSync(resolve(ROOT, "skills/agent-review-panel/references/adaptive-orchestration.md"), "utf8");
const skill = readFileSync(resolve(ROOT, "skills/agent-review-panel/SKILL.md"), "utf8");

describe("adaptive v4 design safety contract", () => {
  it("does not replace the current full protocol", () => {
    assert.match(design, /current v3\.9\.1 protocol, preserved/);
    assert.match(design, /full 15-phase protocol remains/);
  });

  it("distinguishes intentional no-debate from execution failure", () => {
    assert.match(contract, /DEBATE_NOT_NEEDED/);
    assert.match(contract, /NO-DEBATE/);
    assert.match(contract, /successful adaptive stop must not be reported as a protocol failure/);
  });

  it("keeps evidence and safety outside Jev authority", () => {
    assert.match(design, /Jev is \*\*not a reviewer, fact checker, safety authority, or judge of truth\*\*/);
    assert.match(contract, /must not decide truth, severity correctness, shipping safety/);
  });

  it("requires verify-before-debate for cheap factual disputes", () => {
    assert.match(design, /verify before debate/i);
    assert.match(contract, /Route cheap factual disagreements to allowed read-only evidence checks/);
  });

  it("keeps explicit user modes as floors", () => {
    assert.match(contract, /User-explicit modes, personas, exhaustive trace, deep research, multi-run, or full-panel requests are floors/);
  });

  it("forbids fake judge verdicts", () => {
    assert.match(contract, /judge-less run must not claim a Supreme Judge verdict/);
  });

  it("does not add a second Jev skill or transport", () => {
    assert.match(design, /Do not create another skill/);
    assert.match(contract, /Do not create a second transport implementation or another skill/);
  });

  it("keeps current live-state evidence discipline", () => {
    assert.match(contract, /Live-state P0 claims still require live evidence/);
    assert.match(skill, /STATIC-INFERENCE/);
    assert.match(skill, /LIVE-VERIFIED/);
  });

  it("keeps blocked reviewers from becoming consensus", () => {
    assert.match(contract, /Blocked\/missing reviewers are missing evidence, never clean consensus/);
    assert.match(skill, /BLOCKED reviewer is never a clean vote/);
  });

  it("does not claim savings from planned call counts", () => {
    assert.match(design, /Do \*\*not\*\* claim savings from planned call counts alone/);
    assert.match(contract, /Do not infer token savings from this record/);
  });
});
