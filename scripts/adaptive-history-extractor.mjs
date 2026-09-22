// Read-only historical panel-state extractor for adaptive-v4 shadow replay.
// Parses compact metadata only. Never modifies historical state and never claims
// semantic truth from free-form reviewer prose. A field the archive does not state
// is recorded as null and named in provenance.unrecoverable_inputs — it is never
// defaulted to the value that would let the engine skip work.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { classifySignals } from "./adaptive-orchestrator.mjs";

// A severity token is [P0]-[P3], or a word-bounded bare P0-P3, which also covers
// the ID forms "P1-1" and the trailing "— P1". The \b rejects a plural such as
// "the P0s I am keeping", which points at other findings instead of grading this
// heading, so a plural never reads as a severity.
const SEV_TOKEN = /\[(P[0-3])\]|\b(P[0-3])\b/;
const FINDING_HEADING = /^#{2,5}\s+([^\n]+)$/gm;
// Heading shapes that mark a finding rather than the section listing findings:
// an ID prefix ("AC-1", "F12", "P0-1") or an explicit new-finding announcement.
// The bare word "finding" is deliberately absent — it admits "## Findings".
const FINDING_ID_PREFIX = /^[A-Z]{1,4}-?\d+\b/;
const FINDING_WORD = /\bnew finding\b|\bissue\b|\brisk\b|\bnew-/i;
const REPORT_FILE = "review_panel_report.md";
const JUDGE_FILE = "phase_14_judge_ruling.md";
const CONTENT_TYPES = ["documentation", "assessment", "design", "plan", "code"];

export function inferPersona(filename) {
  return basename(filename)
    .replace(/^reviewer_/, "")
    .replace(/_phase_.*\.md$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

// Order is deliberate. Verifiable types are tested before debatable ones, so a
// claim with a direct evidence path is not sent to debate on a tie. local-fact
// stays after judgment: its pattern matches 36 of 56 archived findings even when
// tested last, and promoting it above judgment empties the judgment class
// altogether on the 2026-05-14 run, which would make "no debate candidates" an
// artifact of this ordering rather than a property of the archive.
export function inferClaimType(text) {
  const t = text.toLowerCase();
  if (/live[- ]state|runtime|deployed|production|iam|cron|env var|describe-class/.test(t)) return "runtime";
  if (/external|web[- ]verify|regulat|third[- ]party|product limit|pricing|api semantics/.test(t)) return "external";
  if (/cross[- ]file|multi[- ]file|import|call graph|across files/.test(t)) return "cross-file";
  // "judge" is this panel's own Phase 14 role name and saturates reviewer prose,
  // so match the concept (judgment/judgement) and not the bare substring.
  if (/trade[- ]off|\bjudge?ments?\b|architecture|design choice|feasibility|maintainab/.test(t)) return "judgment";
  if (/grep|line \d+|file exists|constant|missing|present|does not exist|version/.test(t)) return "local-fact";
  return "unknown";
}

// Recovered from the epistemic labels the panel writes into its own state files, so
// the engine's discharge rules run on what the archive states rather than on a bare
// `verified` boolean. Only a stated mechanism counts; anything else stays "unknown",
// which discharges no floor. static-inference is tested first because a section that
// calls its own conclusion an inference must not be upgraded by a probe it quotes.
export function verificationMethodFromText(text) {
  if (/\[STATIC-INFERENCE(-CONSENSUS)?\]/i.test(text)) return "static-inference";
  if (/\[LIVE-VERIFIED\]/i.test(text)) return "live";
  if (/\[WEB-VERIFIED\]/i.test(text)) return "authoritative-source";
  if (/\bgrep -|\brg -/.test(text)) return "grep";
  // Deliberately no rule for a bare "line 42" citation: citing a line is not a record
  // of having checked it, and that rule alone labelled 48 of 56 archived findings "read".
  return "unknown";
}

// Severity comes from the heading only. Reading the section body lets a finding
// that quotes another finding's "P0" in discussion inherit that severity.
export function severityFromHeading(title) {
  const m = SEV_TOKEN.exec(title);
  return m ? (m[1] ?? m[2]).toUpperCase() : null;
}

export function extractFindingsFromMarkdown(text, persona, sourceName) {
  const matches = [...text.matchAll(FINDING_HEADING)];
  const findings = [];
  for (let i = 0; i < matches.length; i++) {
    const title = matches[i][1].trim();
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunk = text.slice(start, end);
    // A heading with no body of its own is a container for the findings below it,
    // not a finding. No length threshold: a real finding can be one short sentence.
    if (!chunk.slice(matches[i][0].length).trim()) continue;
    if (!SEV_TOKEN.test(title) && !FINDING_ID_PREFIX.test(title) && !FINDING_WORD.test(title)) continue;
    findings.push({
      id: `${sourceName}:${findings.length + 1}`,
      title: title.slice(0, 240),
      severity: severityFromHeading(title),
      claim_type: inferClaimType(title + "\n" + chunk.slice(0, 1200)),
      disputed: /disput|disagree|challenge|withdraw|demot|upgrade|rebut/i.test(chunk),
      reviewers: [persona],
      evidence_sources: [sourceName],
      verified: /\[VERIFIED\]|verified independently|i verified|reproduced/i.test(chunk),
      verification_method: verificationMethodFromText(chunk),
      source_file: sourceName
    });
  }
  return findings;
}

function readIfFile(path) {
  return existsSync(path) && statSync(path).isFile() ? readFileSync(path, "utf8") : null;
}

// Every parse below reports the file it read from: a recovered value whose provenance
// names the wrong file is no better than a guess.
function statedLines(sources, label) {
  const out = [];
  for (const { file, text } of sources) {
    const m = text.match(new RegExp(`^\\*\\*${label}:\\*\\*\\s*(.+)$`, "m"));
    if (m) out.push({ file, value: m[1].trim() });
  }
  return out;
}

// The archive states its own type in prose: "documentation base set used",
// "auto-detected: pure documentation". Accepted only when every statement agrees,
// so a mixed or absent statement stays unknown instead of being guessed.
function parseContentType(sources) {
  const found = new Map();
  for (const { file, value } of [...statedLines(sources, "Auto-detected signals"), ...statedLines(sources, "Review mode")]) {
    for (const type of CONTENT_TYPES) if (new RegExp(`\\b${type}\\b`, "i").test(value) && !found.has(type)) found.set(type, file);
  }
  if (found.size !== 1) return { value: null, file: null };
  const [[value, file]] = [...found];
  return { value, file };
}

function parseSignals(sources) {
  const [stated] = statedLines(sources, "Auto-detected signals");
  if (!stated) return { value: null, file: null };
  if (/^none\b/i.test(stated.value)) return { value: [], file: stated.file };
  const listed = stated.value.split(/—|--/)[0].split(/[,/]/).map(s => s.replace(/[`*]/g, "").trim()).filter(Boolean);
  return { value: listed.length ? listed : null, file: listed.length ? stated.file : null };
}

// The archived "Review mode: Exhaustive" is the v3 panel's auto-detected mode.
// It is recorded as a fact and never mapped onto the engine's explicit_mode,
// whose full-coverage vocabulary it does not share.
function parseReviewMode(sources) {
  const [stated] = statedLines(sources, "Review mode");
  return stated ? { value: stated.value.split("(")[0].trim(), file: stated.file } : { value: null, file: null };
}

// Which engine decisions cannot be reached at all, given what the archive failed
// to record. Derived, not hardcoded: an archive that states these fields shrinks
// the list. Branch names follow adaptive-orchestrator.mjs.
// Every input that can route the engine to a full-coverage handoff. Kept in one list so
// a new explicit floor in the engine shows up here as an unrecoverable input, not as a
// quietly unreachable branch.
const EXPLICIT_FULL_INPUTS = ["explicit_mode", "user_requested_full", "explicit_full_panel",
  "explicit_exhaustive_trace", "explicit_deep_research", "explicit_multi_run"];

function unreachableDecisions(unrecoverable, signals) {
  const missing = field => unrecoverable.includes(field);
  const explicitFullReachable = EXPLICIT_FULL_INPUTS.some(f => !missing(f));
  // The engine's per-category high-impact flag is not exported, so any signal it
  // recognises is treated as possibly high-impact. That errs toward calling the
  // escalation branch reachable, and the branch also needs uncertainty_high.
  const highImpactReachable = !missing("high_stakes") || classifySignals(signals).categories.length > 0;
  const decisions = [];
  const blockedBy = new Set();
  if (!explicitFullReachable && !(highImpactReachable && !missing("uncertainty_high"))) {
    decisions.push("ESCALATE_FULL");
    for (const f of [...EXPLICIT_FULL_INPUTS, "high_stakes", "uncertainty_high"]) if (missing(f)) blockedBy.add(f);
  }
  if (missing("debate_unavailable")) {
    decisions.push("UNAVAILABLE");
    blockedBy.add("debate_unavailable");
  }
  const labels = { ESCALATE_FULL: "[ESCALATED-FULL]", UNAVAILABLE: "[NO-DEBATE]" };
  return { decisions, labels: decisions.map(d => labels[d]), blocked_by: [...blockedBy] };
}

export function extractHistoricalState(stateDir, options = {}) {
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
  const judgeText = readIfFile(join(stateDir, JUDGE_FILE));
  const reportText = readIfFile(join(dirname(stateDir), REPORT_FILE));
  const stated = [{ file: REPORT_FILE, text: reportText }, { file: JUDGE_FILE, text: judgeText }].filter(s => s.text !== null);

  const parsedType = parseContentType(stated);
  const parsedSignals = parseSignals(stated);
  const parsedMode = parseReviewMode(stated);
  const source = (provided, parsed) => provided != null ? "provided" : parsed !== null ? "parsed" : "unknown";
  const candidate = {
    content_type: options.content_type ?? parsedType.value,
    signals: options.signals ?? parsedSignals.value,
    explicit_personas: options.explicit_personas ?? null,
    explicit_mode: options.explicit_mode ?? null,
    high_stakes: options.high_stakes ?? null,
    uncertainty_high: options.uncertainty_high ?? null,
    debate_unavailable: options.debate_unavailable ?? null,
    user_requested_full: options.user_requested_full ?? null,
    explicit_full_panel: options.explicit_full_panel ?? null,
    explicit_exhaustive_trace: options.explicit_exhaustive_trace ?? null,
    explicit_deep_research: options.explicit_deep_research ?? null,
    explicit_multi_run: options.explicit_multi_run ?? null
  };
  // A field that ended up null is one the archive did not state. The engine's contract
  // reads absence as "not asserted" and rejects null, so an unrecoverable field is
  // omitted outright and provenance.unrecoverable_inputs is the record of it.
  const unrecoverable = Object.keys(candidate).filter(k => candidate[k] === null);
  const recovered = Object.fromEntries(Object.entries(candidate).filter(([, v]) => v !== null));
  const unreachable = unreachableDecisions(unrecoverable, recovered.signals ?? []);
  const contentTypeSource = source(options.content_type, parsedType.value);

  return {
    provenance: {
      // Relative to the archive root: a decision record meant to be kept and
      // shared must not carry the operator's home directory or session id.
      state_dir: join(basename(dirname(stateDir)), basename(stateDir)),
      path_basis: "relative_to_archive_root",
      source_files: chosen,
      earliest_available_phase: chosen.length ? (phase3.length ? "phase_3" : "phase_5_round1") : null,
      historical_round2_present: hasRound2,
      historical_judge_present: judgeText !== null,
      // Presence is not content: a judge file with no finding headings parses to
      // zero findings downstream, and that zero has to be visible here.
      historical_judge_heading_count: judgeText ? (judgeText.match(/^#{2,5}\s/gm) ?? []).length : 0,
      extraction: "heuristic-metadata-only",
      report_file: reportText !== null ? REPORT_FILE : null,
      content_type_source: contentTypeSource,
      content_type_source_file: contentTypeSource === "parsed" ? parsedType.file : null,
      signals_source: source(options.signals, parsedSignals.value),
      signals_source_file: parsedSignals.file,
      historical_review_mode: parsedMode.value,
      historical_review_mode_source_file: parsedMode.file,
      historical_review_mode_note: "Auto-detected v3 panel mode as the archive records it. It is not the engine's explicit_mode and is deliberately not mapped onto it.",
      persona_selection_meaningful: contentTypeSource !== "unknown",
      persona_selection_note: contentTypeSource === "unknown"
        ? "content_type could not be recovered, so selected_personas came from the engine's fallback branch. Do not read it as the panel this run would have picked."
        : `Persona selection used content_type from content_type_source_file (${contentTypeSource}).`,
      unrecoverable_inputs: unrecoverable,
      unreachable_debate_decisions: unreachable.decisions,
      unreachable_report_labels: unreachable.labels,
      unreachable_blocked_by: unreachable.blocked_by,
      unreachable_note: unreachable.decisions.length
        ? `${unreachable.decisions.join(" and ")} cannot be reached for this run: the archive records none of the inputs listed in unreachable_blocked_by. A false full_escalation here is a missing input, not a measured decision not to escalate.`
        : "All documented debate decisions are reachable from the recovered inputs.",
      explicit_mode_echo_note: "The engine echoes explicit_mode \"adaptive\" because nothing was asserted, not because the archived run requested adaptive mode.",
      independent_evidence_informative: !findings.every(f => f.evidence_sources.length <= 1),
      independent_evidence_note: "evidence_sources carries one file per finding and findings are not clustered across reviewers, so independent_evidence is 1 by construction. It is not a count of how many reviewers raised the finding.",
      verification_method_source: "archive-epistemic-labels-only",
      verification_method_counts: findings.reduce((acc, f) => ({ ...acc, [f.verification_method]: (acc[f.verification_method] ?? 0) + 1 }), {}),
      verified_claim_count: findings.filter(f => f.verified).length,
      // Consequence of the single evidence source above, stated so that a run with no
      // RESOLVED rows is read off these counts instead of assumed to mean no finding
      // was ever settled.
      dischargeable_floors: ["LIGHT"],
      discharge_note: "Independence is not recoverable, so every finding carries one evidence source and the engine's two-source STANDARD and DEEP floors can never be discharged in replay. Only LIGHT-floor findings can be. verified_claim_count and verification_method_counts say how many findings claim verification and how many state a mechanism, so a resolved count of zero is readable from the archive rather than produced by this shape.",
      judge_needed_note: "judge_needed can only come through material_recommendation_unresolved, which is heuristic prose matching. Its high_stakes leg is unrecoverable.",
      warning: "Historical prose parsing is candidate generation, not ground truth."
    },
    ...recovered,
    candidate_personas: [...new Set(personas)],
    material_recommendation_unresolved: findings.some(f => f.disputed),
    findings
  };
}
