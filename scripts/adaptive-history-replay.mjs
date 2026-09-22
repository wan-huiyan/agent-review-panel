#!/usr/bin/env node
import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractHistoricalState } from "./adaptive-history-extractor.mjs";
import { POLICY_VERSION, decideAdaptiveShadow } from "./adaptive-orchestrator.mjs";

// Sorted: readdir order is unspecified, so an unsorted walk lets row order follow the
// filesystem and turns a re-run into a spurious diff for anyone comparing outputs.
function collect(root) {
  const out = [];
  for (const name of readdirSync(root).sort()) {
    const p = join(root, name);
    if (!statSync(p).isDirectory()) continue;
    const state = join(p, "state");
    if (existsSync(state)) out.push({ name, state });
  }
  return out;
}

// Plain sentences, because the row's job is to stop a reader concluding something the
// replay cannot support — that adaptive never escalated, or that one reviewer saw a finding.
function caveats(provenance) {
  const out = [];
  if (provenance.unreachable_debate_decisions.length) out.push(provenance.unreachable_note);
  if (!provenance.persona_selection_meaningful) out.push(provenance.persona_selection_note);
  if (!provenance.independent_evidence_informative) out.push(provenance.independent_evidence_note);
  out.push(provenance.explicit_mode_echo_note);
  out.push(provenance.discharge_note);
  out.push(provenance.judge_needed_note);
  return out;
}

const emit = payload => process.stdout.write(JSON.stringify(payload, null, 2) + "\n");

function main() {
  const root = resolve(process.argv[2] ?? "docs/reviews");
  const envelope = { policy_version: POLICY_VERSION, historical_replay: true, root };
  let runs;
  try {
    runs = collect(root);
  } catch (error) {
    // The likeliest failure is a mistyped path, and the runbook redirects stdout to a
    // file. A raw stack trace on stderr leaves that file empty.
    process.stderr.write(`adaptive-history-replay: cannot read archive root (${error?.code ?? "error"})\n`);
    emit({ ...envelope, root_status: "unavailable", error_type: error?.constructor?.name ?? "Error", run_count: 0, replayed_count: 0, skipped_count: 0, rows: [] });
    process.exitCode = 1;
    return;
  }

  const rows = [];
  for (const run of runs) {
    try {
      const extracted = extractHistoricalState(run.state);
      if (!extracted.provenance.source_files.length) {
        // A run whose files use another phase or naming convention used to vanish here,
        // making "no archives" and "archives I could not read" the same output.
        rows.push({
          run: run.name,
          status: "skipped",
          reason: "no_reviewer_state_file_matched_expected_phase_glob",
          expected_files: "reviewer_*_phase_3.md or reviewer_*_phase_5_round1.md",
          state_files_present: readdirSync(run.state).sort(),
          provenance: extracted.provenance
        });
        continue;
      }
      rows.push({
        run: run.name,
        status: "replayed",
        provenance: extracted.provenance,
        unreachable_debate_decisions: extracted.provenance.unreachable_debate_decisions,
        unreachable_report_labels: extracted.provenance.unreachable_report_labels,
        caveats: caveats(extracted.provenance),
        extracted_finding_count: extracted.findings.length,
        extracted_personas: extracted.candidate_personas,
        shadow: decideAdaptiveShadow(extracted)
      });
    } catch (error) {
      rows.push({ run: run.name, status: "unavailable", error_type: error?.constructor?.name ?? "Error" });
    }
  }

  emit({
    ...envelope,
    // run_count is directories seen. An unreadable run keeps a row, so a partial archive
    // can no longer report the same totals as an empty one.
    run_count: rows.length,
    replayed_count: rows.filter(r => r.status === "replayed").length,
    skipped_count: rows.filter(r => r.status !== "replayed").length,
    rows
  });
}

main();
