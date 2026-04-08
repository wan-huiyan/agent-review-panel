/**
 * Trigger Classification Tests — Multi-Plugin Marketplace
 *
 * Validates eval-suite.json trigger entries for ALL plugins in the marketplace.
 * Iterates over plugins/<name>/eval-suite.json and runs the structural checks
 * against each plugin's own SKILL.md.
 *
 * Structural checks (NOT a full classifier):
 * - Triggers have required fields (prompt, should_trigger)
 * - Positive triggers reference the skill name / slash command / keywords
 * - Negative triggers exist
 * - SKILL.md frontmatter mentions the skill name
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Discover all plugins with eval-suites
// ---------------------------------------------------------------------------

function discoverPluginEvalSuites() {
  const pluginsRoot = resolve(ROOT, "plugins");
  const found = [];

  if (existsSync(pluginsRoot)) {
    for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = resolve(pluginsRoot, entry.name);
      const evalSuitePath = resolve(dir, "eval-suite.json");
      if (!existsSync(evalSuitePath)) continue;

      const skillMdPath = resolve(dir, "SKILL.md");
      const nestedSkillsDir = resolve(dir, "skills");
      let nestedSkillMdPath = null;
      if (!existsSync(skillMdPath) && existsSync(nestedSkillsDir)) {
        try {
          for (const sub of readdirSync(nestedSkillsDir, { withFileTypes: true })) {
            if (!sub.isDirectory()) continue;
            const candidate = resolve(nestedSkillsDir, sub.name, "SKILL.md");
            if (existsSync(candidate)) {
              nestedSkillMdPath = candidate;
              break;
            }
          }
        } catch { /* ignore */ }
      }

      const finalSkillMdPath = existsSync(skillMdPath) ? skillMdPath : nestedSkillMdPath;
      found.push({
        dirName: entry.name,
        evalSuite: JSON.parse(readFileSync(evalSuitePath, "utf-8")),
        skillMdContent: finalSkillMdPath ? readFileSync(finalSkillMdPath, "utf-8") : "",
      });
    }
  }

  // Legacy fallback: root-level eval-suite.json + root SKILL.md
  if (found.length === 0) {
    const legacyEval = resolve(ROOT, "eval-suite.json");
    if (existsSync(legacyEval)) {
      const legacySkill = resolve(ROOT, "SKILL.md");
      found.push({
        dirName: "(legacy-root)",
        evalSuite: JSON.parse(readFileSync(legacyEval, "utf-8")),
        skillMdContent: existsSync(legacySkill) ? readFileSync(legacySkill, "utf-8") : "",
      });
    }
  }

  return found;
}

const pluginEvalSuites = discoverPluginEvalSuites();

if (pluginEvalSuites.length === 0) {
  describe("Trigger classification", () => {
    it("no eval-suite.json found in any plugin — skipping", { skip: "no eval-suite" }, () => {});
  });
} else {
  for (const { dirName, evalSuite, skillMdContent } of pluginEvalSuites) {
    if (!evalSuite.triggers || evalSuite.triggers.length === 0) {
      describe(`Trigger classification — ${dirName}`, () => {
        it("eval-suite has no triggers — skipping", { skip: "no triggers array" }, () => {});
      });
      continue;
    }

    const skillName = evalSuite.skill_name || evalSuite.skill || "";
    const frontmatterMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);
    const frontmatterText = frontmatterMatch
      ? frontmatterMatch[1].replace(/\n\s+/g, " ").toLowerCase()
      : "";

    describe(`Trigger classification — ${dirName}`, () => {
      describe("Trigger entries are well-formed", () => {
        for (const trigger of evalSuite.triggers) {
          it(`${trigger.id || trigger.prompt?.slice(0, 50)}`, () => {
            assert.ok(trigger.prompt, "trigger must have a prompt");
            assert.ok(
              typeof trigger.should_trigger === "boolean",
              "should_trigger must be boolean"
            );
          });
        }
      });

      describe("Positive triggers are relevant to the skill", () => {
        const positives = evalSuite.triggers.filter((t) => t.should_trigger);

        it("has at least one positive trigger", () => {
          assert.ok(positives.length > 0, "must have at least one positive trigger");
        });

        if (skillName) {
          it("at least one trigger references the skill name, slash command, or skill keywords", () => {
            const slashCommand = `/${skillName}`;
            const nameWords = skillName.split("-").filter((w) => w.length > 2);
            const hasReference = positives.some((t) => {
              const lower = t.prompt.toLowerCase();
              return (
                lower.includes(slashCommand.toLowerCase()) ||
                lower.includes(skillName.toLowerCase()) ||
                nameWords.some((w) => lower.includes(w.toLowerCase()))
              );
            });
            assert.ok(
              hasReference,
              `At least one positive trigger should reference "${skillName}", "${slashCommand}", or keywords: ${nameWords.join(", ")}`
            );
          });
        }
      });

      describe("Negative triggers exist", () => {
        const negatives = evalSuite.triggers.filter((t) => !t.should_trigger);

        it("has at least one negative trigger", () => {
          assert.ok(negatives.length > 0, "must have at least one negative trigger");
        });

        const negativesWithMetadata = negatives.filter((t) => t.notes || t.category || t.id);
        if (negativesWithMetadata.length > 0) {
          it("negative triggers with IDs have explanatory notes or category", () => {
            for (const trigger of negativesWithMetadata) {
              if (trigger.id) {
                const hasExplanation = trigger.notes || trigger.category;
                assert.ok(
                  hasExplanation,
                  `Negative trigger "${trigger.id}" should have notes or category`
                );
              }
            }
          });
        }
      });

      if (frontmatterText && skillName) {
        describe("SKILL.md frontmatter contains skill name", () => {
          it("frontmatter mentions skill name", () => {
            assert.ok(
              frontmatterText.includes(skillName.toLowerCase()),
              `SKILL.md frontmatter should contain the skill name "${skillName}"`
            );
          });
        });
      }
    });
  }
}
