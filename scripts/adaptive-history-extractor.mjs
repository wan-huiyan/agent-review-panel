// Read-only historical panel-state extractor for adaptive-v4 shadow replay.
// Parses compact metadata only. Never modifies historical state and never claims
// semantic truth from free-form reviewer prose.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";

const SEV = /\[(P[0-3])\]|\b(P[0-3])\b/g;
const FINDING_HEADING = /^#{2,5}\s+([^\n]+)$/gm;

export function inferPersona(filename) {
  return basename(filename)
    .replace(/^reviewer_/, "")
    .replace(/_phase_.*\.md$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function inferClaimType(text) {
  const t = text.toLowerCase();
  if (/live[- ]state|runtime|deployed|production|iam|cron|env var|describe-class/.test(t)) return "runtime";
  if (/external|web[- ]verify|regulat|third[- ]party|product limit|pricing|api semantics/.test(t)) return "external";
  if (/trade[- ]off|judg|architecture|design choice|feasibility|maintainab/.test(t)) return "judgment";
  if (/cross[- ]file|multi[- ]file|import|call graph|across files/.test(t)) return "cross-file";
  if (/grep|line \d+|file exists|constant|missing|present|does not exist|version/.test(t)) return "local-fact";
  return "unknown";
}

export function extractFindingsFromMarkdown(text, persona, sourceName) {
  const matches = [...text.matchAll(FINDING_HEADING)];
  const findings = [];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    if (!/(P[0-3]|finding|issue|risk|new-)/i.test(title)) continue;
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    const sevs = [...chunk.matchAll(SEV)].map(m => m[1] || m[2]);
    const severity = sevs[0] ?? (title.match(/\bP[0-3]\b/i)?.[0]?.toUpperCase() ?? "P2");
    findings.push({
      id: `${sourceName}:${findings.length + 1}`,
      title: title.slice(0, 240),
      severity,
      claim_type: inferClaimType(title + "\n" + chunk.slice(0, 1200)),
      disputed: /disput|disagree|challenge|withdraw|demot|upgrade|rebut/i.test(chunk),
      reviewers: [persona],
      evidence_sources: [sourceName],
      verified: /\[VERIFIED\]|verified independently|i verified|reproduced/i.test(chunk),
      source_file: sourceName
    });
  }
  return findings;
}

export function extractHistoricalState(stateDir, { content_type = "design", signals = [] } = {}) {
  const entries = readdirSync(stateDir).filter(n => n.endsWith(".md")).sort();
  const phaseFiles = entries.filter(n => /^reviewer_.*_phase_(3|5_round1)\.md$/.test(n));
  // Prefer phase 3 if a complete run has it; otherwise round 1 is the earliest
  // historical snapshot available in older archived runs.
  const phase3 = phaseFiles.filter(n => /_phase_3\.md$/.test(n));
  const chosen = phase3.length ? phase3 : phaseFiles.filter(n => /_phase_5_round1\.md$/.test(n));
  const personas = [];
  const findings = [];
  for (const name of chosen) {
    const path = join(stateDir, name);
    if (!statSync(path).isFile()) continue;
    const persona = inferPersona(name);
    personas.push(persona);
    findings.push(...extractFindingsFromMarkdown(readFileSync(path, "utf8"), persona, name));
  }
  const hasRound2 = entries.some(n => /_phase_5_round2\.md$/.test(n));
  const hasJudge = entries.includes("phase_14_judge_ruling.md");
  return {
    provenance: {
      state_dir: stateDir,
      source_files: chosen,
      earliest_available_phase: phase3.length ? "phase_3" : "phase_5_round1",
      historical_round2_present: hasRound2,
      historical_judge_present: hasJudge,
      extraction: "heuristic-metadata-only",
      warning: "Historical prose parsing is candidate generation, not ground truth."
    },
    content_type,
    signals,
    candidate_personas: [...new Set(personas)],
    explicit_personas: [],
    explicit_mode: "adaptive",
    high_stakes: false,
    uncertainty_high: false,
    material_recommendation_unresolved: findings.some(f => f.disputed),
    findings
  };
}
