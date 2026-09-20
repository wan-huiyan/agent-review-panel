// Shadow-only adaptive v4 decision engine.
// It never launches agents, invokes Jev, edits review state, or authorizes shipping.
// The executor remains v3.9.1 until a later, separately reviewed implementation.

export const POLICY_VERSION = "adaptive-v4-shadow-1";

const HIGH_IMPACT = new Set(["security", "auth", "payment", "production", "migration", "compliance", "data-loss"]);
const EXPLICIT_FULL = new Set(["full", "maximum-coverage", "exhaustive-panel"]);
const ALLOWED_CLAIM_TYPES = new Set(["local-fact", "cross-file", "external", "runtime", "judgment", "unknown"]);

function assertArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}
function bool(value) { return value === true; }
function uniq(xs) { return [...new Set(xs)]; }

export function validateShadowInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("input must be an object");
  for (const key of ["signals", "candidate_personas", "explicit_personas", "findings"]) {
    assertArray(input[key] ?? [], key);
  }
  if (input.explicit_mode != null && typeof input.explicit_mode !== "string") throw new TypeError("explicit_mode must be a string");
  for (const f of input.findings ?? []) {
    if (!f || typeof f !== "object" || typeof f.id !== "string" || !f.id) throw new TypeError("finding id required");
    if (!ALLOWED_CLAIM_TYPES.has(f.claim_type ?? "unknown")) throw new TypeError("unknown claim_type");
    assertArray(f.reviewers ?? [], "finding.reviewers");
    assertArray(f.evidence_sources ?? [], "finding.evidence_sources");
  }
  return input;
}

export function deterministicPersonaSelection(input) {
  const explicit = uniq(input.explicit_personas ?? []);
  const candidates = uniq(input.candidate_personas ?? []);
  const signals = new Set((input.signals ?? []).map(x => String(x).toLowerCase()));
  const selected = [...explicit];

  const prefer = (...needles) => candidates.find(p => needles.some(n => p.toLowerCase().includes(n)));
  const add = p => { if (p && !selected.includes(p)) selected.push(p); };

  if (input.content_type === "plan" || input.content_type === "design") {
    add(prefer("feasibility", "architecture"));
    add(prefer("risk", "devil"));
  } else if (input.content_type === "documentation" || input.content_type === "assessment") {
    add(prefer("clarity", "completeness"));
    add(prefer("accuracy", "fact", "domain"));
  } else {
    add(prefer("correctness", "code"));
    add(prefer("architecture"));
  }

  if ([...signals].some(s => s.includes("security") || s.includes("auth"))) add(prefer("security"));
  else if ([...signals].some(s => s.includes("infra") || s.includes("reliability"))) add(prefer("sre", "reliability", "infra"));
  else if ([...signals].some(s => s.includes("data") || s.includes("sql") || s.includes("ml"))) add(prefer("data", "statistical", "pipeline"));

  add(prefer("devil", "adversarial"));
  for (const p of candidates) if (selected.length < Math.max(2, explicit.length)) add(p);

  // Explicit personas are a floor. Automatic selection targets at most 3 total.
  return uniq([...explicit, ...selected.filter(p => !explicit.includes(p)).slice(0, Math.max(0, 3 - explicit.length))]);
}

export function verificationFloor(finding) {
  const t = finding.claim_type ?? "unknown";
  if (t === "external" || t === "runtime") return "DEEP";
  if (t === "cross-file" || t === "judgment" || t === "unknown") return "STANDARD";
  return "LIGHT";
}

export function classifyFinding(finding) {
  const floor = verificationFloor(finding);
  const independent = new Set(finding.evidence_sources ?? []).size;
  const disputed = bool(finding.disputed);
  const highSeverity = ["P0", "P1"].includes(finding.severity);
  const verified = bool(finding.verified);

  if (verified) return { id: finding.id, action: "RESOLVED", verification_floor: floor, independent_evidence: independent };
  if (highSeverity || disputed) {
    if (finding.claim_type === "local-fact") return { id: finding.id, action: "VERIFY_FIRST", verification_floor: floor, independent_evidence: independent };
    if (finding.claim_type === "runtime" || finding.claim_type === "external" || finding.claim_type === "cross-file")
      return { id: finding.id, action: "VERIFY_FIRST", verification_floor: floor, independent_evidence: independent };
    if (finding.claim_type === "judgment") return { id: finding.id, action: "DEBATE_CANDIDATE", verification_floor: floor, independent_evidence: independent };
    return { id: finding.id, action: "VERIFY_OR_DEBATE", verification_floor: floor, independent_evidence: independent };
  }
  return { id: finding.id, action: "NO_ESCALATION", verification_floor: floor, independent_evidence: independent };
}

export function decideAdaptiveShadow(raw) {
  const input = validateShadowInput(raw);
  const mode = (input.explicit_mode ?? "adaptive").toLowerCase();
  const explicitFull = EXPLICIT_FULL.has(mode) || bool(input.user_requested_full);
  const highImpact = bool(input.high_stakes) || (input.signals ?? []).some(s => HIGH_IMPACT.has(String(s).toLowerCase()));
  const findings = (input.findings ?? []).map(classifyFinding);
  const unresolved = findings.filter(f => !["RESOLVED", "NO_ESCALATION"].includes(f.action));
  const verifyFirst = findings.filter(f => f.action === "VERIFY_FIRST");
  const debateCandidates = findings.filter(f => ["DEBATE_CANDIDATE", "VERIFY_OR_DEBATE"].includes(f.action));

  let debate_decision = "DEBATE_NOT_NEEDED";
  let judge_needed = false;
  let full_escalation = false;
  const reasons = [];

  if (explicitFull) {
    full_escalation = true;
    debate_decision = "ESCALATE_FULL";
    judge_needed = true;
    reasons.push("explicit_full_request_is_authoritative_floor");
  } else if (bool(input.debate_unavailable) && debateCandidates.length) {
    debate_decision = "UNAVAILABLE";
    judge_needed = true;
    reasons.push("material_debate_candidate_but_mechanism_unavailable");
  } else if (verifyFirst.length && debateCandidates.length === 0) {
    debate_decision = "VERIFY_FIRST";
    reasons.push("factual_disputes_have_direct_evidence_path");
  } else if (debateCandidates.length) {
    debate_decision = "DEBATE_ONE_ROUND";
    reasons.push("material_judgment_or_unclassified_disagreement_remains");
  } else {
    reasons.push("no_material_disagreement_after_current_evidence");
  }

  if (!explicitFull) {
    judge_needed = debateCandidates.length > 0 && (highImpact || bool(input.material_recommendation_unresolved));
    if (highImpact && unresolved.length > 0 && bool(input.uncertainty_high)) {
      full_escalation = true;
      debate_decision = "ESCALATE_FULL";
      judge_needed = true;
      reasons.push("high_impact_high_uncertainty_requires_full_escalation");
    }
  }

  return {
    policy_version: POLICY_VERSION,
    mode: "shadow",
    executes_panel: false,
    authorizes_execution: false,
    explicit_mode: mode,
    selected_personas: deterministicPersonaSelection(input),
    finding_decisions: findings,
    debate_decision,
    judge_needed,
    full_escalation,
    report_label: debate_decision === "DEBATE_NOT_NEEDED" ? "[DEBATE-NOT-NEEDED]"
      : debate_decision === "VERIFY_FIRST" ? "[DEBATE-DEFERRED-TO-VERIFICATION]"
      : debate_decision === "UNAVAILABLE" ? "[NO-DEBATE]"
      : full_escalation ? "[ESCALATED-FULL]" : "[ADAPTIVE]",
    reasons,
    provider: { status: "not_requested" },
    observed_usage: null
  };
}
