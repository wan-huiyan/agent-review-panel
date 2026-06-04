/**
 * VoltAgent Catalog Drift Tests
 *
 * The skill's persona/signal mapping tables reference VoltAgent specialist
 * agents by their `voltagent-<family>:<slug>` subagent_type id. Which agent
 * reviews which signal is an editorial choice; whether a referenced agent still
 * EXISTS upstream is a fact that drifts when VoltAgent renames/removes agents.
 *
 * CI has no VoltAgent marketplace installed, so we validate references against a
 * vendored point-in-time snapshot (references/voltagent-catalog.json, regenerated
 * by scripts/refresh-voltagent-catalog.sh). This test is the CI gate that the
 * shell drift-checker (scripts/voltagent-catalog-check.sh) enforces locally.
 *
 * A stale mapping does not break a real run — the skill detects availability live
 * and falls back to a generic reviewer — but a dangling reference means the docs
 * promise an agent that no longer exists, which this test forbids.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SNAPSHOT = resolve(ROOT, "skills/agent-review-panel/references/voltagent-catalog.json");

// LIVE files the runtime relies on. Frozen-history files (changelog.md,
// references/changelog.md, docs/) are intentionally excluded — they preserve
// historical ids that may since have been renamed upstream.
const LIVE_FILES = [
  "skills/agent-review-panel/SKILL.md",
  "skills/plan-review-integrator/SKILL.md",
  "skills/agent-review-panel/eval-suite.json",
  "skills/agent-review-panel/references/prompt-templates.md",
];

const REF_RE = /voltagent-[a-z-]+:[a-z0-9.][a-z0-9.-]*/g;

const snapshot = existsSync(SNAPSHOT)
  ? JSON.parse(readFileSync(SNAPSHOT, "utf-8"))
  : null;

function realAgentSet() {
  const set = new Set();
  for (const [ns, slugs] of Object.entries(snapshot.families)) {
    for (const slug of slugs) set.add(`${ns}:${slug}`);
  }
  return set;
}

function collectReferences() {
  const refs = new Map(); // ref -> [files]
  for (const rel of LIVE_FILES) {
    const p = resolve(ROOT, rel);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf-8");
    for (const m of text.match(REF_RE) ?? []) {
      if (!refs.has(m)) refs.set(m, []);
      if (!refs.get(m).includes(rel)) refs.get(m).push(rel);
    }
  }
  return refs;
}

describe("VoltAgent catalog snapshot", () => {
  it("exists, parses, and carries provenance", () => {
    assert.ok(snapshot, "references/voltagent-catalog.json missing or unparseable");
    const prov = snapshot._provenance ?? {};
    assert.ok(prov.snapshot_date, "snapshot missing _provenance.snapshot_date");
    assert.ok(prov.marketplace_version, "snapshot missing _provenance.marketplace_version");
    assert.ok(prov.source_repo, "snapshot missing _provenance.source_repo");
  });

  it("has internally consistent counts and no README pseudo-agents", () => {
    const families = Object.entries(snapshot.families);
    const total = families.reduce((n, [, slugs]) => n + slugs.length, 0);
    assert.equal(snapshot._provenance.families, families.length, "family count mismatch");
    assert.equal(snapshot._provenance.total_agents, total, "total_agents mismatch");
    for (const [ns, slugs] of families) {
      assert.ok(slugs.length > 0, `family ${ns} is empty`);
      assert.ok(!slugs.includes("README"), `family ${ns} leaked a README pseudo-agent`);
    }
  });
});

describe("VoltAgent mapping drift", () => {
  it("references at least the known core mappings (sanity: regex + files wired)", () => {
    const refs = collectReferences();
    assert.ok(refs.size >= 50, `only ${refs.size} refs found — files or regex likely misconfigured`);
    assert.ok(refs.has("voltagent-qa-sec:code-reviewer"), "expected core ref not found");
  });

  it("has no dangling references — every live voltagent id exists in the snapshot", () => {
    const real = realAgentSet();
    const refs = collectReferences();
    const dangling = [...refs.keys()]
      .filter((r) => !real.has(r))
      .map((r) => `${r}  <- ${refs.get(r).join(", ")}`);
    assert.equal(
      dangling.length,
      0,
      `Dangling VoltAgent references (refresh the snapshot or fix the mapping):\n  ${dangling.join("\n  ")}`,
    );
  });

  it("every referenced namespace resolves to a real family", () => {
    const families = new Set(Object.keys(snapshot.families));
    const refs = collectReferences();
    const badNs = [...refs.keys()]
      .map((r) => r.split(":")[0])
      .filter((ns) => !families.has(ns));
    assert.equal(badNs.length, 0, `Unknown voltagent families referenced: ${[...new Set(badNs)].join(", ")}`);
  });
});
