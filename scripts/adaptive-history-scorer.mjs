// Conservative historical comparison scorer for adaptive-v4 shadow evaluation.
// It measures observable archive properties; it does not claim the counterfactual
// adaptive run would have discovered the same findings.
//
// Every count is emitted beside the coverage of the parser or matcher that produced
// it, so a reader can tell "the archive shows nothing" from "the parser read
// nothing". Where coverage is zero the scorer emits no interpretation sentence at
// all: a confident negative drawn from a parser that read nothing is the failure
// this file exists to prevent, and a comparison that cannot fail is not evidence.

import { extractFindingsFromMarkdown, severityFromHeading } from "./adaptive-history-extractor.mjs";

export const JUDGE_SOURCE = "phase_14_judge_ruling.md";
// Unchanged from the first version of this file, deliberately. Neither threshold is
// recalibrated and neither formula for early-vs-round-2 comparison is changed; the
// coverage fields below report how far the archive falls short of them instead.
export const ATTRIBUTION_THRESHOLD = 0.12;
export const NOVELTY_THRESHOLD = 0.35;

// The same heading shape the extractor counts for provenance.historical_judge_heading_count,
// so headings_seen here and that figure are the same number on the same file.
const JUDGE_HEADING = /^#{2,5}\s+([^\n]+)$/gm;
// A reviewer finding ID as these archives write it: AC-5, P0-1, F7, DA-9, P2-10.
// A bare P0-P3 is a severity grade rather than an ID, so it is excluded.
const FINDING_ID = /\b(?:[A-Z]{1,4}-\d+[A-Za-z]?|[A-Z]{1,4}\d+)\b/g;
const SEVERITY_GRADE = /^P[0-3]$/;
// "Demoted from P0 to P1" names the grade the ruling rejected before the one it
// imposed, so first-token-wins stores the severity the judge explicitly overturned.
const SEVERITY_TRANSITION = /\b(?:demot|downgrad|upgrad|promot|rais|lower)\w*\b[^\n]*?\bto\b/i;
// The same phrase the extractor admits a finding heading on. It is the archive stating
// that this item is new in this round, which is the only direct evidence of round-2
// novelty here that does not pass through a similarity score.
const NEW_FINDING_ANNOUNCEMENT = /\bnew finding\b/i;

const round3 = n => Math.round(n * 1000) / 1000;

function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\[[^\]]+\]/g, " ")
    .replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(w => w.length > 2);
}
function jaccard(a, b) {
  const A = new Set(norm(a)), B = new Set(norm(b));
  if (!A.size || !B.size) return 0;
  let n = 0; for (const x of A) if (B.has(x)) n++;
  return n / (A.size + B.size - n);
}

// An exact channel beside the lexical one. A reviewer writes its finding ID into its
// own heading and quotes the IDs it is answering, so this is a token the archive
// states rather than a similarity anyone can dial.
export function findingIdsIn(text) {
  const out = new Set();
  for (const m of String(text ?? "").matchAll(FINDING_ID)) if (!SEVERITY_GRADE.test(m[0])) out.add(m[0].toUpperCase());
  return [...out].sort();
}

// The severity a ruling imposes, never the one it overturned, and null when the
// heading states none. The tail after the transition's "to" is read through the
// extractor's own heading parser so there is one severity vocabulary, not a copy.
export function judgeSeverityFromHeading(title) {
  const text = String(title ?? "");
  const m = SEVERITY_TRANSITION.exec(text);
  if (m) {
    const imposed = severityFromHeading(text.slice(m.index + m[0].length));
    if (imposed) return { severity: imposed, overturned: severityFromHeading(m[0]) };
  }
  return { severity: severityFromHeading(text), overturned: null };
}

// Section bodies keyed by the same truncated title the extractor emits, so a finding
// can be paired back to its own body without a second copy of the admission rule.
function judgeSections(text) {
  const heads = [...text.matchAll(JUDGE_HEADING)];
  const bodies = new Map();
  for (let i = 0; i < heads.length; i++) {
    const start = heads[i].index + heads[i][0].length;
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    bodies.set(heads[i][1].trim().slice(0, 240), text.slice(start, end));
  }
  return { headings: heads.map(h => h[1].trim()), bodies };
}

export function parseJudgeRuling(text) {
  const src = String(text ?? "");
  const { headings, bodies } = judgeSections(src);
  // One admission vocabulary for reviewer files and judge rulings. The local copy this
  // replaces admitted any heading containing the word "finding", which turned the
  // content-free "## Rulings on every disputed finding" and the multi-row tables
  // "## Rejected findings" and "## Judge-introduced findings" into findings of their own.
  const findings = extractFindingsFromMarkdown(src, "Judge", JUDGE_SOURCE).map(f => {
    const { severity, overturned } = judgeSeverityFromHeading(f.title);
    const body = bodies.get(f.title) ?? "";
    return {
      ...f,
      severity,
      severity_overturned: overturned,
      cited_finding_ids: findingIdsIn(`${f.title}\n${body}`),
      text: body.slice(0, 3000)
    };
  });
  const kept = new Set(findings.map(f => f.title));
  const emptyParse = headings.length > 0 && findings.length === 0;
  return {
    findings,
    coverage: {
      source_file: JUDGE_SOURCE,
      headings_seen: headings.length,
      headings_matched: findings.length,
      matched_fraction: headings.length ? round3(findings.length / headings.length) : null,
      headings_unmatched: headings.filter(h => !kept.has(h.slice(0, 240))),
      severity_stated: findings.filter(f => f.severity !== null).length,
      severity_unstated: findings.filter(f => f.severity === null).length,
      severity_corrected_from_overturned: findings.filter(f => f.severity_overturned !== null).length,
      parsed_nothing_from_a_non_empty_file: emptyParse,
      note: emptyParse
        ? "Every heading in this ruling was rejected by the finding-admission rule, so a judge-finding count of zero says this parser read nothing rather than that the ruling carried nothing. This ruling records its action items as a numbered list under a section heading, which a heading parser cannot see."
        : "A judge finding is a heading that carries a severity token, an ID-shaped prefix or an explicit new-finding announcement, and that has a body of its own. headings_unmatched lists every heading skipped, so the next ruling's heading style cannot fail silently."
    }
  };
}

// Kept for callers that want the findings without the coverage block.
export function parseJudgeFindings(text) {
  return parseJudgeRuling(text).findings;
}

function distribution(scores) {
  if (!scores.length) return null;
  const s = [...scores].sort((a, b) => a - b);
  return {
    count: s.length,
    min: round3(s[0]),
    median: round3(s[Math.floor(s.length / 2)]),
    max: round3(s[s.length - 1])
  };
}

function judgeNeededState(shadow) {
  if (!("judge_needed" in shadow)) return "not_recorded";
  if (shadow.judge_needed === true) return "required";
  if (shadow.judge_needed === false) return "not_needed";
  if (shadow.judge_needed === null) return "deferred_pending_unresolved_work";
  return "unrecognised_value";
}

export function compareArchive({
  earlyFindings = [], earlyPhase = null, round2Findings = [], round2Present = null,
  judgeFindings = [], judgeCoverage = null, judgeSourcePresent = null, shadow
}) {
  // A phase_3 run has no round 1. The label travels with the count so no reader has to
  // assume which phase "early" was.
  const early = earlyPhase ?? earlyFindings.find(f => f.phase)?.phase ?? "early_phase";
  const hasRound2 = round2Present ?? round2Findings.length > 0;
  const pool = [
    ...earlyFindings.map(f => ({ phase: early, title: f.title })),
    ...round2Findings.map(f => ({ phase: "round2", title: f.title }))
  ];

  const judgeMatches = judgeFindings.map(j => {
    const ranked = pool.map(f => ({ phase: f.phase, title: f.title, score: jaccard(j.title, f.title) }))
      .sort((a, b) => b.score - a.score);
    const supersededBest = pool.reduce((m, f) => Math.max(m, jaccard(`${j.title} ${j.text ?? ""}`, f.title)), 0);
    return { best: ranked[0] ?? null, superseded_best: supersededBest };
  });
  const firstSeen = { [early]: 0, round2: 0, unmatched: 0 };
  for (const m of judgeMatches) {
    if (!m.best || m.best.score < ATTRIBUTION_THRESHOLD) firstSeen.unmatched++;
    else firstSeen[m.best.phase]++;
  }
  const judgeMatched = judgeMatches.filter(m => m.best && m.best.score >= ATTRIBUTION_THRESHOLD).length;
  const supersededMatched = judgeMatches.filter(m => m.superseded_best >= ATTRIBUTION_THRESHOLD).length;
  const judgeAtNovelty = judgeMatches.filter(m => m.best && m.best.score >= NOVELTY_THRESHOLD).length;
  // How many judge findings the matcher sends to the same reviewer title. A matcher that
  // attributes is close to one-to-one; one that sends six rulings to the same title is
  // scoring shared stopwords like "part" and "rule", which is what these archives show.
  const bestTitleCounts = new Map();
  for (const m of judgeMatches) {
    if (!m.best || m.best.score < ATTRIBUTION_THRESHOLD) continue;
    bestTitleCounts.set(m.best.title, (bestTitleCounts.get(m.best.title) ?? 0) + 1);
  }
  const maxCollision = bestTitleCounts.size ? Math.max(...bestTitleCounts.values()) : 0;

  const pairScores = [];
  for (const r of earlyFindings) for (const f of round2Findings) pairScores.push(jaccard(r.title, f.title));
  const noveltyReachable = pairScores.some(s => s >= NOVELTY_THRESHOLD);
  const round2Novel = round2Findings.filter(f => !earlyFindings.some(r => jaccard(r.title, f.title) >= NOVELTY_THRESHOLD));

  // A severity the archive never stated has not changed severity, it is unknown. Such a
  // pair is counted in its own bucket and excluded from both changed and unchanged, so
  // the change count never rests on treating null as a grade.
  const severity = { changed: 0, unchanged: 0, indeterminate_severity_unstated: 0 };
  for (const r of earlyFindings) for (const f of round2Findings) {
    if (jaccard(r.title, f.title) < NOVELTY_THRESHOLD) continue;
    if (r.severity == null || f.severity == null) severity.indeterminate_severity_unstated++;
    else if (r.severity !== f.severity) severity.changed++;
    else severity.unchanged++;
  }

  const announced = round2Findings.filter(f => NEW_FINDING_ANNOUNCEMENT.test(f.title));
  const earlyIds = new Set(earlyFindings.flatMap(f => findingIdsIn(f.title)));
  const citation = { round2_findings: round2Findings.length, cites_early_finding_id: 0, cites_only_unresolved_id: 0, cites_no_finding_id: 0 };
  const unresolved = new Set();
  for (const f of round2Findings) {
    const ids = findingIdsIn(f.title);
    if (!ids.length) { citation.cites_no_finding_id++; continue; }
    if (ids.some(id => earlyIds.has(id))) citation.cites_early_finding_id++;
    else citation.cites_only_unresolved_id++;
    for (const id of ids) if (!earlyIds.has(id)) unresolved.add(id);
  }

  const disputedIds = new Set(earlyFindings.filter(f => f.disputed).flatMap(f => findingIdsIn(f.title)));
  const round2Ids = new Set(round2Findings.flatMap(f => findingIdsIn(f.title)));
  const disputeOverlap = {
    early_findings_marked_disputed: earlyFindings.filter(f => f.disputed).length,
    early_disputed_finding_ids: disputedIds.size,
    early_disputed_ids_revisited_in_round2: [...disputedIds].filter(id => round2Ids.has(id)).length
  };

  // A source the provenance block says is present but that parsed to nothing. This is the
  // flag that separates thin evidence from a parser or glob that returned zero.
  const parsedEmpty = [];
  if (!earlyFindings.length) parsedEmpty.push("reviewer_*_phase_3.md or reviewer_*_phase_5_round1.md");
  if (hasRound2 && !round2Findings.length) parsedEmpty.push("reviewer_*_phase_5_round2.md");
  if ((judgeSourcePresent ?? (judgeCoverage?.headings_seen ?? 0) > 0) && !judgeFindings.length) parsedEmpty.push(JUDGE_SOURCE);

  // Coverage of the exact channels only. The lexical channel is excluded from the grade
  // for the reason stated in judge_match_coverage.note: it does not discriminate here.
  const idCoverage = round2Findings.length ? (citation.cites_early_finding_id + citation.cites_only_unresolved_id) / round2Findings.length : 0;
  const evidenceStrength =
    parsedEmpty.length ? "unmeasurable_parser_returned_nothing_for_a_present_source"
      : !hasRound2 ? "unmeasurable_archive_has_no_round_2"
        : !idCoverage && !announced.length && !noveltyReachable ? "unmeasurable_no_channel_reaches_its_threshold"
          : idCoverage >= 0.9 && disputeOverlap.early_disputed_ids_revisited_in_round2 > 0 ? "stronger"
            : idCoverage >= 0.8 ? "moderate"
              : idCoverage >= 0.5 ? "weak"
                : "unmeasurable_no_channel_reaches_its_threshold";

  // Each reason is a fact about coverage, not a hedge. While any is present the scorer
  // emits no interpretation: the sentence it used to emit asserted a negative about a
  // round 2 that did not exist, from a parser that had read nothing.
  const withheld = [];
  if (!judgeFindings.length) withheld.push(judgeCoverage?.parsed_nothing_from_a_non_empty_file ? "judge_parser_matched_no_heading_in_a_non_empty_ruling" : "no_judge_finding_available");
  if (!hasRound2) withheld.push("archive_has_no_round_2_to_compare");
  if (hasRound2 && !round2Findings.length) withheld.push("round_2_is_present_in_the_archive_but_parsed_to_no_findings");

  // Only channels that can return the other answer. The judge lexical channel is not
  // one of them: its best scores all sit below the level at which this same scorer will
  // call two titles the same finding, and one reviewer title is the best match for
  // several unrelated rulings, so first_seen.round2 > 0 is not evidence of anything.
  const positive = [];
  if (announced.length) positive.push(`round2_headings_announcing_a_new_finding (${announced.length} of ${round2Findings.length})`);
  // Sub-threshold pairs are not evidence of novelty. When no pair on the corpus reaches
  // the novelty threshold, every round-2 finding is "novel" by construction and the
  // count carries no information, so it cannot support a verdict either way.
  if (noveltyReachable && round2Novel.length > 0) positive.push(`round2_title_unmatched_in_${early}_at_or_above_${NOVELTY_THRESHOLD} (${round2Novel.length} of ${round2Findings.length})`);

  return {
    archive_observation_only: true,
    counterfactual_claim: false,
    evidence_strength: evidenceStrength,
    evidence_strength_basis: `Round-2 headings the finding-ID channel can place at all: ${citation.cites_early_finding_id + citation.cites_only_unresolved_id} of ${round2Findings.length}, of which ${citation.cites_early_finding_id} name an ID the ${early} phase carries. Round-2 headings announcing a new finding: ${announced.length}. Early disputed finding IDs revisited in round 2: ${disputeOverlap.early_disputed_ids_revisited_in_round2} of ${disputeOverlap.early_disputed_finding_ids}. Sources the archive has but that parsed to nothing: ${parsedEmpty.length}. The judge lexical channel is excluded from this grade; see judge_match_coverage.note.`,
    parsed_empty_for_present_source: parsedEmpty,
    historical: {
      early_phase: early,
      early_findings: earlyFindings.length,
      round2_present: hasRound2,
      round2_findings: round2Findings.length,
      judge_findings: judgeFindings.length,
      judge_best_match_first_seen: firstSeen,
      judge_best_match_first_seen_is_attribution: false,
      round2_headings_announcing_a_new_finding: announced.length,
      round2_novel_candidate_count: round2Novel.length,
      round2_novel_candidate_count_is_measured: noveltyReachable,
      round2_severity_change_candidate_count: severity.changed,
      round2_severity_unchanged_candidate_count: severity.unchanged,
      round2_severity_indeterminate_count: severity.indeterminate_severity_unstated
    },
    judge_parser_coverage: judgeCoverage,
    judge_match_coverage: {
      threshold: ATTRIBUTION_THRESHOLD,
      formula: "jaccard(judge_heading, reviewer_title)",
      judge_findings: judgeFindings.length,
      matched_at_threshold: judgeMatched,
      unmatched: judgeFindings.length - judgeMatched,
      matched_fraction: judgeFindings.length ? round3(judgeMatched / judgeFindings.length) : null,
      matched_at_novelty_threshold: judgeAtNovelty,
      best_score_distribution: distribution(judgeMatches.map(m => m.best?.score ?? 0)),
      distinct_best_match_titles: bestTitleCounts.size,
      max_judge_findings_sharing_one_best_match: maxCollision,
      used_for_interpretation: false,
      note: `This channel is reported and not used. Its best scores are counted against ${ATTRIBUTION_THRESHOLD}, but ${judgeAtNovelty} of ${judgeFindings.length} reach ${NOVELTY_THRESHOLD}, the level at which this same scorer is willing to say two titles describe the same finding; and ${maxCollision} judge findings share one best-match reviewer title, so the ranking is driven by shared common words rather than by subject. judge_best_match_first_seen is an observation about this matcher, not an attribution of the finding.`,
      superseded_formula: {
        formula: "jaccard(judge_heading + judge_body, reviewer_title)",
        matched_at_threshold: supersededMatched,
        best_score_distribution: distribution(judgeMatches.map(m => m.superseded_best)),
        reason: "A judge body normalises to roughly 24-361 words against reviewer titles of 6-14, and set-size asymmetry alone holds Jaccard near zero whatever the wording. Both distributions are reported so the change is auditable; neither licenses a conclusion on its own."
      }
    },
    round2_novelty_coverage: {
      threshold: NOVELTY_THRESHOLD,
      formula: "jaccard(early_title, round2_title)",
      pair_count: pairScores.length,
      pairs_at_or_above_novelty_threshold: pairScores.filter(s => s >= NOVELTY_THRESHOLD).length,
      pairs_at_or_above_attribution_threshold: pairScores.filter(s => s >= ATTRIBUTION_THRESHOLD).length,
      score_distribution: distribution(pairScores),
      novelty_threshold_reachable: noveltyReachable,
      note: pairScores.length && !noveltyReachable
        ? "No title pair on this corpus reaches the novelty threshold, so round2_novel_candidate_count equals round2_findings by construction and the severity comparison has no pair to run on. Neither figure is a measurement of this archive."
        : "Every early-phase title was scored against every round-2 title; the distribution says how close the corpus comes to the threshold."
    },
    round2_finding_id_citation: {
      ...citation,
      unresolved_cited_ids: [...unresolved].sort(),
      note: "An exact token match, not a similarity: a round-2 heading that names an earlier finding's ID is answering that finding. An unresolved ID is either a finding first raised in round 2 or a reviewer renamed between rounds, and the two cannot be told apart here."
    },
    dispute_overlap: disputeOverlap,
    shadow_record_present: shadow != null,
    shadow: shadow == null ? null : {
      debate_decision: shadow.debate_decision ?? null,
      judge_needed: "judge_needed" in shadow ? shadow.judge_needed : null,
      // The engine's judge_needed is tri-state. A missing shadow record is a fourth
      // case, and collapsing the two used to make a deferred question and an absent
      // record the same null.
      judge_needed_state: judgeNeededState(shadow),
      full_escalation: shadow.full_escalation ?? null,
      policy_version: shadow.policy_version ?? null
    },
    interpretation: withheld.length ? null
      : positive.length
        ? "Later debate contains candidate information not obviously present in round 1; do not treat it as redundant."
        : "No round-2 heading announced a new finding, and no round-2 title cleared the novelty threshold against the earlier phase. This supports a replay candidate, not a proof that round 2 was unnecessary.",
    interpretation_withheld_reasons: withheld,
    interpretation_basis: positive,
    limitations: [
      "Lexical matching is heuristic and can miss paraphrases or falsely merge related findings.",
      "norm() drops tokens of two characters or fewer, so the bare ID forms AC, DA and F are removed from the prose channel. The finding-ID channel is reported separately for that reason and is not affected.",
      "Historical reviewers saw different context than a future adaptive panel would see.",
      "A finding absent from the archive cannot be treated as evidence that adaptive would not discover it.",
      "A severity the archive never stated is counted as indeterminate. It is neither a change nor an agreement, and it is never read as P2.",
      "A finding ID that resolves to no early-phase heading may be new in round 2 or the same finding under a name assigned later; this comparison cannot separate those."
    ]
  };
}
