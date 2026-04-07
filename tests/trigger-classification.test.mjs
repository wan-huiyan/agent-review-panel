import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const evalSuite = JSON.parse(
  readFileSync(resolve(ROOT, "eval-suite.json"), "utf-8")
);
const skillMd = readFileSync(
  resolve(ROOT, "skills/agent-review-panel/SKILL.md"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Trigger keyword extraction from SKILL.md frontmatter
// ---------------------------------------------------------------------------

// Primary trigger phrases from the description field
const POSITIVE_PHRASES = [
  "review panel",
  "multi-agent review",
  "adversarial review",
  "have agents debate",
  "review with multiple perspectives",
  "panel review",
  "get different opinions",
  "/agent-review-panel",
  "thorough feedback from different angles",
  "stress-test",
  "red team",
  "second opinion",
  "third opinion",
  "fourth opinion",
  "fresh eyes",
  "multiple reviewers",
  "devil's advocate",
  "every angle covered",
  "agents to argue",
  "independently evaluate",
  "critical look from",
  "high-stakes",
  "cover every angle",
  "debate the pros and cons",
  "debate pros and cons",
  "deep review",
  "thorough review",
  "research review",
  "multiple perspectives",
  "multiple independent",
  "adversarial analysis",
  "different angles",
  "different opinions",
  "multiple agents",
  "specialist subagents",
  "specialist agents",
  // v2.11 additions
  "multi-run review",
  "run twice",
  "run 3 times",
  "maximum coverage review",
  "exhaustive review",
  "trace everything",
  "catch all bugs",
];

// Anti-trigger signals — single-agent, bug fix, or non-review tasks
const NEGATIVE_SIGNALS = [
  "fix the",
  "fix this",
  "write unit tests",
  "write tests",
  "deploy this",
  "deploy to ",
  "what does this code do",
  "help me write a readme",
  "create a new skill",
  "improve the error handling",
  "refactor",
  "benchmark",
  "check my code and fix",
  "address the feedback",
  "address the pr comments",
  "install",
  "just a quick",
  "quick sanity check",
  "peer review",
  "what do you think",
  "is this any good",
  "is it any good",
];

/**
 * Lightweight trigger classifier that mirrors the SKILL.md heuristic.
 *
 * Returns true when ANY positive phrase is found AND no dominant negative
 * signal overrides it. This is intentionally conservative — the real Claude
 * skill uses richer NLU, so we test that the eval-suite examples are
 * well-formed rather than reimplementing the full classifier.
 */
function classifyTrigger(prompt) {
  const lower = prompt.toLowerCase();

  // Slash command is always a trigger
  if (lower.includes("/agent-review-panel")) return true;

  // Check for negative signals first — these are strong overrides
  const hasNegativeSignal = NEGATIVE_SIGNALS.some((neg) => lower.includes(neg));

  // Check for positive phrases
  const matchedPositives = POSITIVE_PHRASES.filter((phrase) =>
    lower.includes(phrase.toLowerCase())
  );

  // Multi-perspective signals (weaker individually, strong together)
  const multiPerspectiveSignals = [
    "multiple",
    "perspectives",
    "angles",
    "opinions",
    "reviewers",
    "agents",
    "debate",
    "argue",
    "independently",
    "different",
    "panel",
    "adversarial",
    "red team",
    "stress-test",
    "thorough",
    "thoroughly",
    "every angle",
    "angle",
    "critical look",
    "subagent",
    "specialist",
    "fresh eyes",
    "devil",
    "advocate",
    "harsh",
    "high-stakes",
    "critical path",
    "qa",
    "devops",
    "data science",
  ];
  const perspectiveCount = multiPerspectiveSignals.filter((s) =>
    lower.includes(s)
  ).length;

  if (hasNegativeSignal && matchedPositives.length === 0) return false;
  if (matchedPositives.length > 0) return true;
  // 2+ multi-perspective signals without negative override → likely trigger
  if (perspectiveCount >= 2 && !hasNegativeSignal) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Trigger classification", () => {
  describe("eval-suite.json triggers are well-formed", () => {
    for (const trigger of evalSuite.triggers) {
      it(`${trigger.id}: ${trigger.prompt.slice(0, 60)}`, () => {
        assert.ok(trigger.id, "trigger must have an id");
        assert.ok(trigger.prompt, "trigger must have a prompt");
        assert.ok(
          typeof trigger.should_trigger === "boolean",
          "should_trigger must be boolean"
        );
        assert.ok(trigger.category, "trigger must have a category");
      });
    }
  });

  describe("Positive triggers match at least one known trigger phrase", () => {
    const positives = evalSuite.triggers.filter((t) => t.should_trigger);
    for (const trigger of positives) {
      it(`${trigger.id}: should trigger — "${trigger.prompt.slice(0, 60)}"`, () => {
        const result = classifyTrigger(trigger.prompt);
        assert.equal(
          result,
          true,
          `Expected trigger for: "${trigger.prompt}" (${trigger.notes})`
        );
      });
    }
  });

  describe("Negative triggers do NOT match trigger phrases", () => {
    const negatives = evalSuite.triggers.filter(
      (t) => !t.should_trigger && t.category.startsWith("negative")
    );
    for (const trigger of negatives) {
      it(`${trigger.id}: should NOT trigger — "${trigger.prompt.slice(0, 60)}"`, () => {
        const result = classifyTrigger(trigger.prompt);
        assert.equal(
          result,
          false,
          `Expected NO trigger for: "${trigger.prompt}" (${trigger.notes})`
        );
      });
    }
  });

  describe("Edge cases match expected classification", () => {
    const edges = evalSuite.triggers.filter((t) => t.category.startsWith("edge"));
    for (const trigger of edges) {
      it(`${trigger.id}: ${trigger.should_trigger ? "SHOULD" : "should NOT"} trigger — "${trigger.prompt.slice(0, 60)}"`, () => {
        const result = classifyTrigger(trigger.prompt);
        assert.equal(
          result,
          trigger.should_trigger,
          `Expected ${trigger.should_trigger ? "trigger" : "no trigger"} for: "${trigger.prompt}" (${trigger.notes})`
        );
      });
    }
  });

  describe("SKILL.md frontmatter contains all documented trigger phrases", () => {
    // Extract the YAML description block — handle YAML folded scalar (>)
    // which joins lines with spaces
    const frontmatterMatch = skillMd.match(/^---\n([\s\S]*?)\n---/);
    assert.ok(frontmatterMatch, "SKILL.md must have YAML frontmatter");
    const frontmatter = frontmatterMatch[1]
      .replace(/\n\s+/g, " ")  // fold multi-line YAML values into single line
      .toLowerCase();

    const expectedInDescription = [
      "review panel",
      "multi-agent review",
      "adversarial review",
      "have agents debate this",
      "panel review",
      "stress-test",
      "red team",
      "fresh eyes",
      "multiple reviewers",
      "devil's advocate",
      "deep review",
    ];

    for (const phrase of expectedInDescription) {
      it(`frontmatter mentions: "${phrase}"`, () => {
        assert.ok(
          frontmatter.includes(phrase),
          `SKILL.md frontmatter should contain trigger phrase: "${phrase}"`
        );
      });
    }
  });

  describe("SKILL.md 'When NOT to Use' section covers negative triggers", () => {
    const notSection = skillMd
      .split("## When NOT to Use")[1]
      ?.split("\n##")[0]
      ?.toLowerCase();
    assert.ok(notSection, "SKILL.md must have a 'When NOT to Use' section");

    const expectedNegatives = [
      "single code review",
      "quick sanity check",
      "bug fix",
      "code explanation",
      "deployment",
      "skill improvement",
      "writing tests",
      "single opinion",
    ];

    for (const phrase of expectedNegatives) {
      it(`'When NOT to Use' covers: "${phrase}"`, () => {
        assert.ok(
          notSection.includes(phrase),
          `'When NOT to Use' section should mention: "${phrase}"`
        );
      });
    }
  });
});
