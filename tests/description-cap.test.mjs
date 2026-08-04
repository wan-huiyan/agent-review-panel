/**
 * Description-Cap Tests
 *
 * Claude Code injects each model-invocable skill's name + description into
 * context on every turn, capped per skill by `skillListingMaxDescChars`
 * (default 1536). Over the cap the harness keeps `full[:1535]` and appends an
 * ellipsis — it does NOT truncate intelligently.
 *
 * A description is TRIGGER TEXT, so every phrase past that character position
 * is dead: the skill cannot fire on it and nothing reports the loss.
 *
 * This repo learned that the expensive way. The cap was breached in v2.14
 * (Data Flow Trace + Multi-Run Union pushed the description 1501 -> 2004), and
 * v3.7.1 — a release whose entire purpose was budget-mode *discoverability* —
 * added five trigger phrases that all landed past the cut. By v3.8.0 the
 * description was 2703 chars and 25 of its 51 trigger phrases were invisible,
 * including every single budget-mode trigger.
 *
 * These tests keep that from recurring.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const GATE = resolve(ROOT, "scripts", "check_skill_descriptions.py");
const CAP = 1536;

function descriptionOf(skillMd) {
  const fm = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return null;
  const m = fm[1].match(/^description: >\s*\n((?:[ \t]+.*\n?)*)/m);
  if (!m) return null;
  return m[1]
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

const skillDirs = readdirSync(resolve(ROOT, "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((n) => existsSync(resolve(ROOT, "skills", n, "SKILL.md")));

describe("Description cap", () => {
  it("the gate script is present", () => {
    assert.ok(existsSync(GATE), "scripts/check_skill_descriptions.py is missing");
  });

  it("every shipped skill passes the gate", () => {
    const r = spawnSync("python3", [GATE, resolve(ROOT, "skills"), "--no-color", "--triggers"], {
      encoding: "utf-8",
    });
    assert.equal(r.status, 0, `a description is over the cap:\n${r.stdout}`);
  });

  for (const name of skillDirs) {
    it(`${name}: listing entry fits within ${CAP} chars`, () => {
      const md = readFileSync(resolve(ROOT, "skills", name, "SKILL.md"), "utf-8");
      const desc = descriptionOf(md);
      assert.ok(desc, `could not parse a folded description from skills/${name}/SKILL.md`);
      // The listing entry is name + 4 chars of framing + the description.
      const entry = name.length + 4 + desc.length;
      assert.ok(
        entry <= CAP,
        `${name} listing entry is ${entry} chars (${entry - CAP} over ${CAP}). ` +
          `Trigger phrases past char ${CAP - 1} cannot fire. ` +
          `Run: python3 scripts/check_skill_descriptions.py skills --triggers`
      );
    });
  }

  it("no eval-suite positive trigger relies on an invisible phrase", () => {
    // Every quoted trigger in a description must sit inside the cap. A quoted
    // phrase past the cut reads as supported in the source but is unreachable.
    for (const name of skillDirs) {
      const md = readFileSync(resolve(ROOT, "skills", name, "SKILL.md"), "utf-8");
      const desc = descriptionOf(md);
      if (!desc) continue;
      const visible = desc.slice(0, CAP - 1 - (name.length + 4));
      const quoted = [...desc.matchAll(/"([^"\n]{3,80})"/g)].map((m) => m[1]);
      const lost = quoted.filter((q) => !visible.includes(q));
      assert.deepEqual(
        lost,
        [],
        `${name}: these trigger phrases are past the truncation point and can never fire: ${lost.join(", ")}`
      );
    }
  });
});
