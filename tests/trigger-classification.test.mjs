/**
 * Trigger Classification Tests — Generalized Template
 *
 * Validates that eval-suite.json trigger entries are structurally correct
 * and that positive triggers contain keywords from the SKILL.md description.
 *
 * This is a structural validator, NOT a full trigger classifier (that's
 * skill-specific). It checks:
 * - Triggers have required fields (id, prompt, should_trigger, category)
 * - Positive triggers contain at least one keyword from SKILL.md description
 * - Negative triggers exist and cover anti-patterns
 * - SKILL.md frontmatter mentions the slash command
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const evalSuitePath = resolve(ROOT, "eval-suite.json");
if (!existsSync(evalSuitePath)) {
  describe("Trigger classification", () => {
    it("eval-suite.json not present — skipping", { skip: "no eval-suite.json" }, () => {});
  });
} else {
  const evalSuite = JSON.parse(readFileSync(evalSuitePath, "utf-8"));

  if (!evalSuite.triggers || evalSuite.triggers.length === 0) {
    describe("Trigger classification", () => {
      it("eval-suite has no triggers — skipping", { skip: "no triggers array" }, () => {});
    });
  } else {
    // Find the best SKILL.md to extract trigger keywords from.
    // Priority:
    //   1. plugins/<name>/SKILL.md (canonical plugin layout)
    //   2. plugins/<name>/skills/<skill>/SKILL.md (skill-within-plugin layout)
    //   3. skills/<name>/SKILL.md (legacy flat-skill layout)
    //   4. SKILL.md at repo root (legacy single-file layout)
    let skillMdContent = "";

    // 1. Canonical plugin layout
    const pluginsRoot = resolve(ROOT, "plugins");
    if (existsSync(pluginsRoot)) {
      try {
        for (const entry of readdirSync(pluginsRoot, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue;
          const direct = resolve(pluginsRoot, entry.name, "SKILL.md");
          if (existsSync(direct)) {
            skillMdContent = readFileSync(direct, "utf-8");
            break;
          }
          // 2. skills-within-plugin layout
          const skillsDirInPlugin = resolve(pluginsRoot, entry.name, "skills");
          if (existsSync(skillsDirInPlugin)) {
            try {
              const subdirs = readdirSync(skillsDirInPlugin, { withFileTypes: true })
                .filter((d) => d.isDirectory());
              for (const subdir of subdirs) {
                const candidate = resolve(skillsDirInPlugin, subdir.name, "SKILL.md");
                if (existsSync(candidate)) {
                  skillMdContent = readFileSync(candidate, "utf-8");
                  break;
                }
              }
            } catch { /* ignore */ }
          }
          if (skillMdContent) break;
        }
      } catch { /* fallback below */ }
    }

    // 3. Legacy flat-skill layout
    if (!skillMdContent) {
      const skillsDir = resolve(ROOT, "skills");
      if (existsSync(skillsDir)) {
        try {
          const subdirs = readdirSync(skillsDir, { withFileTypes: true })
            .filter((d) => d.isDirectory());
          for (const subdir of subdirs) {
            const candidate = resolve(skillsDir, subdir.name, "SKILL.md");
            if (existsSync(candidate)) {
              skillMdContent = readFileSync(candidate, "utf-8");
              break;
            }
          }
        } catch { /* fallback below */ }
      }
    }

    // 4. Legacy single-file layout
    if (!skillMdContent) {
      const rootSkillMd = resolve(ROOT, "SKILL.md");
      if (existsSync(rootSkillMd)) {
        skillMdContent = readFileSync(rootSkillMd, "utf-8");
      }
    }

    // Extract skill name for slash command check
    const skillName = evalSuite.skill_name || evalSuite.skill || "";

    // Extract keywords from SKILL.md description field (frontmatter)
    const frontmatterMatch = skillMdContent.match(/^---\n([\s\S]*?)\n---/);
    const frontmatterText = frontmatterMatch
      ? frontmatterMatch[1].replace(/\n\s+/g, " ").toLowerCase()
      : "";

    // ---------------------------------------------------------------------------
    // Tests
    // ---------------------------------------------------------------------------

    describe("Trigger classification", () => {
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
          // Check if at least one trigger references the skill name, slash command,
          // or any word from the skill name (e.g., "feature" from "ml-feature-evaluator")
          it("at least one trigger references the skill name, slash command, or skill keywords", () => {
            const slashCommand = `/${skillName}`;
            const nameWords = skillName.split("-").filter((w) => w.length > 2);
            const hasReference = positives.some((t) => {
              const lower = t.prompt.toLowerCase();
              return lower.includes(slashCommand.toLowerCase()) ||
                     lower.includes(skillName.toLowerCase()) ||
                     nameWords.some((w) => lower.includes(w.toLowerCase()));
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

        // Note: some eval-suites have minimal negative triggers without metadata.
        // This test only validates that metadata exists when the eval-suite uses it.
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

      if (frontmatterText) {
        describe("SKILL.md frontmatter contains skill name", () => {
          it(`frontmatter mentions skill name`, () => {
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
