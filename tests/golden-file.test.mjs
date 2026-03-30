import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const FIXTURES = resolve(__dirname, "fixtures");
const GOLDEN = resolve(__dirname, "golden");

// ---------------------------------------------------------------------------
// Golden-file infrastructure
//
// Phase 4: Structural snapshot tests. Rather than comparing exact text
// (which would break on every minor wording change), we extract a
// structural "fingerprint" from each report and compare that.
// ---------------------------------------------------------------------------

/**
 * Extract a structural fingerprint from a report.
 * This captures the shape of the report, not the exact wording.
 */
function extractFingerprint(markdown) {
  const fingerprint = {
    version: 1, // bump this when fingerprint format changes

    // Section inventory (which sections exist)
    sections: [],

    // Header field presence
    headerFields: [],

    // Structural metrics
    metrics: {
      reviewerCount: 0,
      actionItemCount: 0,
      debateRoundCount: 0,
      epistemicLabelsUsed: [],
      hasCollapsibleSections: false,
      hasScoreTable: false,
      hasClaimVerification: false,
      hasSeverityVerification: false,
      hasCorrelationNotice: false,
      hasHumanReviewWarning: false,
    },
  };

  // --- Sections ---
  const sectionMatches = markdown.matchAll(/^## ([^\n]+)/gm);
  for (const match of sectionMatches) {
    fingerprint.sections.push(match[1].trim());
  }

  // --- Header fields ---
  const headerFields = [
    "Work reviewed",
    "Date",
    "Panel",
    "Verdict",
    "Confidence",
    "Auto-detected signals",
    "Review mode",
  ];
  for (const field of headerFields) {
    if (markdown.includes(`**${field}:**`)) {
      fingerprint.headerFields.push(field);
    }
  }

  // --- Metrics ---
  const panelMatch = markdown.match(/\*\*Panel:\*\*\s*(\d+)\s*reviewers/);
  fingerprint.metrics.reviewerCount = panelMatch ? parseInt(panelMatch[1]) : 0;

  const actionLines = (
    markdown.match(/^\d+\.\s+\*\*\[P[0-3]\]/gm) || []
  ).length;
  fingerprint.metrics.actionItemCount = actionLines;

  const roundMatches = markdown.match(/Round \d+ Summary/g) || [];
  fingerprint.metrics.debateRoundCount = roundMatches.length;

  const labels = ["VERIFIED", "CONSENSUS", "SINGLE-SOURCE", "UNVERIFIED", "DISPUTED"];
  fingerprint.metrics.epistemicLabelsUsed = labels.filter((l) =>
    markdown.includes(`[${l}]`)
  );

  fingerprint.metrics.hasCollapsibleSections = /<details>/.test(markdown);
  fingerprint.metrics.hasScoreTable = /\|\s*Reviewer\s*\|/.test(markdown);
  fingerprint.metrics.hasClaimVerification = /Claim Verification/i.test(markdown);
  fingerprint.metrics.hasSeverityVerification = /Severity Verification/i.test(markdown);
  fingerprint.metrics.hasCorrelationNotice = /Correlation Notice/i.test(markdown);
  fingerprint.metrics.hasHumanReviewWarning = /HUMAN REVIEW RECOMMENDED/i.test(markdown);

  return fingerprint;
}

/**
 * Compare two fingerprints and return differences.
 */
function diffFingerprints(expected, actual) {
  const diffs = [];

  // Compare sections
  const missingSections = expected.sections.filter(
    (s) => !actual.sections.includes(s)
  );
  const extraSections = actual.sections.filter(
    (s) => !expected.sections.includes(s)
  );
  if (missingSections.length > 0)
    diffs.push(`Missing sections: ${missingSections.join(", ")}`);
  if (extraSections.length > 0)
    diffs.push(`Extra sections: ${extraSections.join(", ")}`);

  // Compare header fields
  const missingHeaders = expected.headerFields.filter(
    (h) => !actual.headerFields.includes(h)
  );
  if (missingHeaders.length > 0)
    diffs.push(`Missing header fields: ${missingHeaders.join(", ")}`);

  // Compare key metrics
  if (expected.metrics.reviewerCount !== actual.metrics.reviewerCount)
    diffs.push(
      `Reviewer count: expected ${expected.metrics.reviewerCount}, got ${actual.metrics.reviewerCount}`
    );

  if (expected.metrics.hasScoreTable !== actual.metrics.hasScoreTable)
    diffs.push(`Score table: expected ${expected.metrics.hasScoreTable}`);

  if (expected.metrics.hasCollapsibleSections !== actual.metrics.hasCollapsibleSections)
    diffs.push(`Collapsible sections: expected ${expected.metrics.hasCollapsibleSections}`);

  // Compare epistemic label usage
  const missingLabels = expected.metrics.epistemicLabelsUsed.filter(
    (l) => !actual.metrics.epistemicLabelsUsed.includes(l)
  );
  if (missingLabels.length > 0)
    diffs.push(`Missing epistemic labels: ${missingLabels.join(", ")}`);

  return diffs;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Golden-file structural snapshots", () => {
  const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === "1";

  describe("Fingerprint extraction", () => {
    it("extracts sections from a report", () => {
      const md = "# Title\n## Section A\ncontent\n## Section B\ncontent";
      const fp = extractFingerprint(md);
      assert.deepEqual(fp.sections, ["Section A", "Section B"]);
    });

    it("counts reviewers from Panel header", () => {
      const md = "**Panel:** 4 reviewers + Auditor + Judge";
      const fp = extractFingerprint(md);
      assert.equal(fp.metrics.reviewerCount, 4);
    });

    it("detects epistemic labels", () => {
      const md = "This is [VERIFIED] and [DISPUTED] content";
      const fp = extractFingerprint(md);
      assert.deepEqual(fp.metrics.epistemicLabelsUsed, ["VERIFIED", "DISPUTED"]);
    });

    it("counts action items with severity", () => {
      const md = "1. **[P0]** Fix this\n2. **[P1]** Fix that\n3. **[P2]** Nice to have";
      const fp = extractFingerprint(md);
      assert.equal(fp.metrics.actionItemCount, 3);
    });

    it("counts debate rounds", () => {
      const md = "### Round 1 Summary\n### Round 2 Summary\n### Round 3 Summary";
      const fp = extractFingerprint(md);
      assert.equal(fp.metrics.debateRoundCount, 3);
    });
  });

  describe("Fingerprint comparison", () => {
    it("reports no diffs for identical fingerprints", () => {
      const fp = extractFingerprint(
        readFileSync(resolve(FIXTURES, "sample-report-valid.md"), "utf-8")
      );
      const diffs = diffFingerprints(fp, fp);
      assert.equal(diffs.length, 0);
    });

    it("detects missing sections", () => {
      const expected = { sections: ["A", "B", "C"], headerFields: [], metrics: { reviewerCount: 0, hasScoreTable: false, hasCollapsibleSections: false, epistemicLabelsUsed: [] } };
      const actual = { sections: ["A", "C"], headerFields: [], metrics: { reviewerCount: 0, hasScoreTable: false, hasCollapsibleSections: false, epistemicLabelsUsed: [] } };
      const diffs = diffFingerprints(expected, actual);
      assert.ok(diffs.some((d) => d.includes("Missing sections: B")));
    });

    it("detects reviewer count changes", () => {
      const expected = { sections: [], headerFields: [], metrics: { reviewerCount: 4, hasScoreTable: true, hasCollapsibleSections: true, epistemicLabelsUsed: [] } };
      const actual = { sections: [], headerFields: [], metrics: { reviewerCount: 3, hasScoreTable: true, hasCollapsibleSections: true, epistemicLabelsUsed: [] } };
      const diffs = diffFingerprints(expected, actual);
      assert.ok(diffs.some((d) => d.includes("Reviewer count")));
    });
  });

  describe("Golden files for fixtures", () => {
    const fixtureFiles = readdirSync(FIXTURES).filter((f) => f.endsWith(".md"));

    for (const file of fixtureFiles) {
      const content = readFileSync(resolve(FIXTURES, file), "utf-8");
      const actual = extractFingerprint(content);
      const goldenPath = resolve(GOLDEN, `${basename(file, ".md")}.golden.json`);

      if (UPDATE_GOLDEN) {
        it(`${file}: updates golden file`, () => {
          writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + "\n");
          assert.ok(true, "Golden file updated");
        });
      } else if (existsSync(goldenPath)) {
        it(`${file}: matches golden snapshot`, () => {
          const expected = JSON.parse(readFileSync(goldenPath, "utf-8"));
          const diffs = diffFingerprints(expected, actual);
          assert.equal(
            diffs.length,
            0,
            `Golden file mismatch for ${file}:\n${diffs.join("\n")}\n\nRun UPDATE_GOLDEN=1 npm run test:golden to update.`
          );
        });
      } else {
        it(`${file}: golden file missing — run UPDATE_GOLDEN=1 to create`, () => {
          // Auto-create on first run so tests pass out of the box
          writeFileSync(goldenPath, JSON.stringify(actual, null, 2) + "\n");
          assert.ok(true, "Golden file created");
        });
      }
    }
  });

  describe("Archived report structural stability", () => {
    const archived = readFileSync(
      resolve(ROOT, "docs/archive/review_panel_report.md"),
      "utf-8"
    );
    const fp = extractFingerprint(archived);

    it("has at least 4 sections", () => {
      assert.ok(
        fp.sections.length >= 4,
        `Expected at least 4 sections, got ${fp.sections.length}: ${fp.sections.join(", ")}`
      );
    });

    it("has score table", () => {
      assert.ok(fp.metrics.hasScoreTable, "archived report should have score table");
    });

    it("has at least 2 reviewers", () => {
      assert.ok(
        fp.metrics.reviewerCount >= 2,
        `Expected at least 2 reviewers, got ${fp.metrics.reviewerCount}`
      );
    });

    it("has action items", () => {
      assert.ok(
        fp.metrics.actionItemCount >= 1,
        `Expected action items, got ${fp.metrics.actionItemCount}`
      );
    });
  });
});

// Export for use in other files
export { extractFingerprint, diffFingerprints };
