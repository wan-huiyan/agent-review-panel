// Shadow-only adaptive v4 decision engine.
// It never launches agents, invokes Jev, edits review state, or authorizes shipping.
// The executor remains v3.9.1 until a later, separately reviewed implementation.
//
// Every ambiguous input resolves toward more review, never less, and the record says why:
// an undetermined field is recorded as "unknown" and routed as if it were material.

export const POLICY_VERSION = "adaptive-v4-shadow-3";

// One signal vocabulary for both escalation and specialist routing (contract invariant 3,
// design A0/A1). Table order is the specialist precedence order, so the result never
// depends on the order signals arrive in.
const SIGNAL_TABLE = new Map([
  ["security", { high_impact: true, specialist: ["security", "appsec"] }],
  ["payments", { high_impact: true, specialist: ["payment", "billing", "security"] }],
  ["data-loss", { high_impact: true, specialist: ["data", "database", "pipeline"] }],
  ["compliance", { high_impact: true, specialist: ["compliance", "legal", "security"] }],
  ["production", { high_impact: true, specialist: ["sre", "reliability", "infra"] }],
  ["infrastructure", { high_impact: true, specialist: ["sre", "reliability", "infra"] }],
  ["migration", { high_impact: true, specialist: ["data", "database", "pipeline"] }],
  ["reliability", { high_impact: false, specialist: ["sre", "reliability", "infra"] }],
  ["data", { high_impact: false, specialist: ["data", "statistical", "pipeline"] }]
]);
// Spelling variants of the same category. Matching is whole-token, never substring, so
// "documentation-authoring" stays one unrecognised token instead of hitting "auth".
const SIGNAL_ALIAS = new Map([
  ["auth", "security"], ["authn", "security"], ["authz", "security"],
  ["authentication", "security"], ["authorization", "security"],
  ["payment", "payments"], ["dataloss", "data-loss"], ["infra", "infrastructure"],
  ["prod", "production"], ["migrations", "migration"], ["sre", "reliability"],
  ["sql", "data"], ["ml", "data"], ["pipeline", "data"]
]);

const EXPLICIT_FULL_MODES = new Set(["full", "maximum-coverage", "exhaustive-panel"]);
const ALLOWED_MODES = new Set(["adaptive", "budget", ...EXPLICIT_FULL_MODES]);
const ALLOWED_CLAIM_TYPES = new Set(["local-fact", "cross-file", "external", "runtime", "judgment", "unknown"]);
const ALLOWED_SEVERITIES = new Set(["P0", "P1", "P2", "P3", "unknown"]);
const ALLOWED_VERIFICATION = new Set(["grep", "read", "live", "authoritative-source", "static-inference", "unknown"]);
// An undetermined severity routes like P0/P1: a severity nobody supplied must not buy the cheapest run.
const ESCALATING_SEVERITIES = new Set(["P0", "P1", "unknown"]);
// STATIC-INFERENCE is the declared fallback for "could not check", so it discharges nothing.
const DIRECT_EVIDENCE = new Set(["grep", "read", "live", "authoritative-source"]);
const LIVE_EVIDENCE = new Set(["live", "authoritative-source"]);

const ARRAY_FIELDS = ["signals", "candidate_personas", "explicit_personas", "findings"];
const BOOLEAN_FIELDS = [
  "high_stakes", "uncertainty_high", "debate_unavailable", "material_recommendation_unresolved",
  "user_requested_full", "explicit_full_panel", "explicit_exhaustive_trace",
  "explicit_deep_research", "explicit_multi_run"
];

function uniq(xs) { return [...new Set(xs)]; }
function personaKey(name) { return String(name).trim().toLowerCase().replace(/\s+/g, " "); }

// Absent means "not asserted"; present-but-wrong-typed is an error, never a silent false.
function requireBool(value, name) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") throw new TypeError(`${name} must be a boolean`);
  return value;
}
function requireArray(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
  return value;
}
// Error messages stay input-free: the shadow record must be serializable without private content.
function requireMember(value, allowed, name) {
  if (!allowed.has(value)) throw new TypeError(`unknown ${name}`);
  return value;
}

function normaliseFinding(finding) {
  if (!finding || typeof finding !== "object" || Array.isArray(finding) || typeof finding.id !== "string" || !finding.id)
    throw new TypeError("finding id required");
  return {
    ...finding,
    severity: requireMember(finding.severity ?? "unknown", ALLOWED_SEVERITIES, "severity"),
    claim_type: requireMember(finding.claim_type ?? "unknown", ALLOWED_CLAIM_TYPES, "claim_type"),
    verification_method: requireMember(finding.verification_method ?? "unknown", ALLOWED_VERIFICATION, "verification_method"),
    disputed: requireBool(finding.disputed, "finding.disputed"),
    verified: requireBool(finding.verified, "finding.verified"),
    reviewers: requireArray(finding.reviewers, "finding.reviewers"),
    evidence_sources: requireArray(finding.evidence_sources, "finding.evidence_sources")
  };
}

// Returns a normalised copy. Callers read the copy, so no downstream branch re-guesses a field.
export function validateShadowInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("input must be an object");
  const out = { ...input };
  for (const key of ARRAY_FIELDS) out[key] = requireArray(input[key], key);
  for (const key of BOOLEAN_FIELDS) out[key] = requireBool(input[key], key);
  if (input.explicit_mode != null && typeof input.explicit_mode !== "string") throw new TypeError("explicit_mode must be a string");
  out.explicit_mode = requireMember((input.explicit_mode ?? "adaptive").trim().toLowerCase(), ALLOWED_MODES, "explicit_mode");
  out.findings = out.findings.map(normaliseFinding);
  const ids = new Set();
  for (const f of out.findings) {
    if (ids.has(f.id)) throw new TypeError("duplicate finding id");
    ids.add(f.id);
  }
  return out;
}

// Exported so callers can resolve a signal against the one vocabulary instead of
// mirroring a copy of it.
export function classifySignals(signals) {
  const categories = [];
  const unrecognised = [];
  for (const raw of signals) {
    const token = String(raw).trim().toLowerCase().replace(/[\s_-]+/g, "-").replace(/^-|-$/g, "");
    const canonical = SIGNAL_ALIAS.get(token) ?? token;
    if (SIGNAL_TABLE.has(canonical)) categories.push(canonical);
    else unrecognised.push(String(raw));
  }
  return {
    categories: [...SIGNAL_TABLE.keys()].filter(c => categories.includes(c)),
    unrecognised: uniq(unrecognised)
  };
}

function highImpactCategories(categories) {
  return categories.filter(c => SIGNAL_TABLE.get(c).high_impact);
}

// The escalation branch's own predicate, exported so a caller can ask whether a signal set
// could reach ESCALATE_FULL without re-deriving the rule from a copy of the table.
// Unrecognised signals are not high impact here, exactly as they are not in the decision.
export function highImpactSignals(signals) {
  return highImpactCategories(classifySignals(signals).categories);
}

export function verificationFloor(finding) {
  const t = finding.claim_type ?? "unknown";
  if (t === "external" || t === "runtime") return "DEEP";
  if (t === "cross-file" || t === "judgment" || t === "unknown") return "STANDARD";
  return "LIGHT";
}

// Invariant 6: one shared artifact is one source, so it cannot discharge STANDARD or DEEP.
// Invariant 7: a live-state claim needs live evidence, never a caller-set boolean.
function dischargesFloor(floor, finding) {
  const method = finding.verification_method;
  const sources = new Set(finding.evidence_sources).size;
  if (!DIRECT_EVIDENCE.has(method)) return false;
  if (floor === "LIGHT") return sources >= 1;
  if (floor === "STANDARD") return sources >= 2;
  return sources >= 2 && LIVE_EVIDENCE.has(method) && (finding.claim_type !== "runtime" || method === "live");
}

export function classifyFinding(finding) {
  const f = normaliseFinding(finding);
  const floor = verificationFloor(f);
  const discharged = f.verified && dischargesFloor(floor, f);
  const material = ESCALATING_SEVERITIES.has(f.severity) || f.disputed;
  // A dispute survives verification: the dispute is now about whether the check settles it.
  const action = discharged && !f.disputed ? "RESOLVED"
    : !material ? "NO_ESCALATION"
    : f.claim_type === "judgment" ? "DEBATE_CANDIDATE"
    : f.claim_type === "unknown" ? "VERIFY_OR_DEBATE"
    : "VERIFY_FIRST";
  return {
    id: f.id,
    action,
    severity: f.severity,
    claim_type: f.claim_type,
    // Recorded beside the status so a discharged-but-unresolved finding says why.
    disputed: f.disputed,
    verification_floor: floor,
    independent_evidence: new Set(f.evidence_sources).size,
    verification_method: f.verification_method,
    verification_status: !f.verified ? "not_claimed" : discharged ? "discharged" : "claimed_not_discharged"
  };
}

function selectPersonas(input) {
  const reasons = [];
  const explicit = [];
  for (const p of input.explicit_personas) if (!explicit.some(x => personaKey(x) === personaKey(p))) explicit.push(p);
  const candidates = [];
  for (const p of input.candidate_personas) if (!candidates.some(x => personaKey(x) === personaKey(p))) candidates.push(p);

  const taken = new Set(explicit.map(personaKey));
  const prefer = (...needles) => candidates.find(p => !taken.has(personaKey(p)) && needles.some(n => personaKey(p).includes(n)));

  let generic;
  if (input.content_type === "plan" || input.content_type === "design") generic = [["feasibility", "architecture"], ["risk", "devil"]];
  else if (input.content_type === "documentation" || input.content_type === "assessment") generic = [["clarity", "completeness"], ["accuracy", "fact", "domain"]];
  else generic = [["correctness", "code"], ["architecture"]];

  const { categories } = classifySignals(input.signals);
  const specialist = categories.length ? SIGNAL_TABLE.get(categories[0]).specialist : null;
  // The specialist is picked before the second generic perspective so the slot cap cuts the
  // generic one first (contract: add a domain specialist when a strong signal exists).
  const slots = [generic[0], specialist, generic[1], ["devil", "adversarial"]].filter(Boolean);

  const auto = [];
  for (const needles of slots) {
    const p = prefer(...needles);
    if (!p) continue;
    taken.add(personaKey(p));
    auto.push({ persona: p, specialist: needles === specialist });
  }
  if (specialist && !auto.some(x => x.specialist)) reasons.push("domain_specialist_absent_from_candidate_pool");

  const kept = auto.slice(0, Math.max(0, 3 - explicit.length));
  if (auto.some(x => x.specialist) && !kept.some(x => x.specialist)) reasons.push("domain_specialist_dropped_for_capacity");

  const personas = [...explicit, ...kept.map(x => x.persona)];
  const target = Math.max(2, explicit.length);
  for (const p of candidates) {
    if (personas.length >= target) break;
    if (!personas.some(x => personaKey(x) === personaKey(p))) personas.push(p);
  }
  if (personas.length < 2) reasons.push("persona_target_unmet_candidate_pool_too_thin");
  return { personas, reasons };
}

export function deterministicPersonaSelection(input) {
  return selectPersonas(validateShadowInput(input)).personas;
}

export function decideAdaptiveShadow(raw) {
  const input = validateShadowInput(raw);
  const { categories, unrecognised } = classifySignals(input.signals);
  const highImpactSignal = highImpactCategories(categories).length > 0;
  const highImpact = input.high_stakes || highImpactSignal;
  const findings = input.findings.map(f => classifyFinding(f));
  const unresolved = findings.filter(f => !["RESOLVED", "NO_ESCALATION"].includes(f.action));
  const verifyFirst = findings.filter(f => f.action === "VERIFY_FIRST");
  const debateCandidates = findings.filter(f => ["DEBATE_CANDIDATE", "VERIFY_OR_DEBATE"].includes(f.action));
  const materialUnavailable = input.debate_unavailable && debateCandidates.length > 0;
  const personas = selectPersonas(input);

  // Contract invariant 3. A named modifier is a floor adaptive cannot express, so it hands
  // off to the full protocol instead of being dropped.
  const fullRequest = EXPLICIT_FULL_MODES.has(input.explicit_mode) || input.user_requested_full || input.explicit_full_panel;
  const modifierFloors = ["explicit_exhaustive_trace", "explicit_deep_research", "explicit_multi_run"].filter(k => input[k]);
  const explicit_floors = [
    ...(EXPLICIT_FULL_MODES.has(input.explicit_mode) ? [`explicit_mode_${input.explicit_mode}`] : []),
    ...(input.user_requested_full ? ["user_requested_full"] : []),
    ...(input.explicit_full_panel ? ["explicit_full_panel"] : []),
    ...modifierFloors
  ];

  // One escalation state. debate_decision, judge_needed, report_label and reasons are all
  // derived from it, so a reason can only appear for the branch that produced the answer.
  const state = explicit_floors.length ? "ESCALATE_FULL_EXPLICIT"
    : highImpact && unresolved.length && input.uncertainty_high ? "ESCALATE_FULL_UNCERTAIN"
    : materialUnavailable ? "UNAVAILABLE"
    : verifyFirst.length && !debateCandidates.length ? "VERIFY_FIRST"
    : debateCandidates.length ? "DEBATE_ONE_ROUND"
    : "DEBATE_NOT_NEEDED";

  const full_escalation = state.startsWith("ESCALATE_FULL");
  const debate_decision = full_escalation ? "ESCALATE_FULL" : state;
  // The judge gate runs after verification and any debate round, so while unresolved work is
  // still pending the question has no answer yet. Three values, never two: true means a judge
  // is required now, false means none is needed and nothing is pending, null means the answer
  // waits on the pending step. Collapsing null to false would report "no judge" for work that
  // has not been done.
  const judgeRequired = full_escalation || state === "UNAVAILABLE"
    || (debateCandidates.length > 0 && (highImpact || input.material_recommendation_unresolved));
  const judge_needed = judgeRequired ? true : unresolved.length ? null : false;

  const reasons = [];
  if (state === "ESCALATE_FULL_EXPLICIT") {
    if (fullRequest) reasons.push("explicit_full_request_is_authoritative_floor");
    if (modifierFloors.length) reasons.push("explicit_modifier_floor_requires_full_protocol_handoff");
  } else if (state === "ESCALATE_FULL_UNCERTAIN") reasons.push("high_impact_high_uncertainty_requires_full_escalation");
  else if (state === "UNAVAILABLE") reasons.push("material_debate_candidate_but_mechanism_unavailable");
  else if (state === "VERIFY_FIRST") reasons.push("factual_disputes_have_direct_evidence_path");
  else if (state === "DEBATE_ONE_ROUND") reasons.push("material_judgment_or_unclassified_disagreement_remains");
  else reasons.push("no_material_disagreement_after_current_evidence");

  if (judge_needed === null) reasons.push(state === "VERIFY_FIRST"
    ? "judge_decision_deferred_pending_verification"
    : "judge_decision_deferred_pending_debate_round");

  // Facts that are true alongside the decision rather than instead of it.
  if (materialUnavailable && state !== "UNAVAILABLE") reasons.push("escalation_handoff_cannot_run_debate_mechanism_unavailable");
  if (input.debate_unavailable && !debateCandidates.length) reasons.push("debate_mechanism_unavailable_no_material_debate_candidate");
  if (highImpactSignal) reasons.push("high_impact_signal_present");
  if (unrecognised.length) reasons.push("unrecognised_signal_recorded_not_classified");
  if (findings.some(f => f.verification_status === "claimed_not_discharged")) reasons.push("verified_claim_did_not_discharge_verification_floor");
  reasons.push(...personas.reasons);

  return {
    policy_version: POLICY_VERSION,
    mode: "shadow",
    executes_panel: false,
    authorizes_execution: false,
    explicit_mode: input.explicit_mode,
    explicit_floors,
    selected_personas: personas.personas,
    signal_categories: categories,
    unrecognised_signals: unrecognised,
    finding_decisions: findings,
    debate_decision,
    debate_mechanism_unavailable: input.debate_unavailable,
    judge_needed,
    full_escalation,
    report_label: full_escalation ? "[ESCALATED-FULL]"
      : state === "UNAVAILABLE" ? "[NO-DEBATE]"
      : state === "VERIFY_FIRST" ? "[DEBATE-DEFERRED-TO-VERIFICATION]"
      : state === "DEBATE_NOT_NEEDED" ? "[DEBATE-NOT-NEEDED]"
      : "[ADAPTIVE]",
    reasons,
    provider: { status: "not_requested" },
    observed_usage: null
  };
}
