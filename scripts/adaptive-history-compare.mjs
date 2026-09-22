#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractFindingsFromMarkdown, extractHistoricalState, inferPersona } from "./adaptive-history-extractor.mjs";
import { decideAdaptiveShadow } from "./adaptive-orchestrator.mjs";
import { compareArchive, parseJudgeRuling } from "./adaptive-history-scorer.mjs";

const JUDGE_FILE = "phase_14_judge_ruling.md";
const EXPECTED_EARLY = "reviewer_*_phase_3.md or reviewer_*_phase_5_round1.md";

// Sorted: readdir order is unspecified, so an unsorted walk lets row order follow the
// filesystem and turns a re-run into a spurious diff for anyone comparing outputs.
function dirs(root) {
  return readdirSync(root).sort()
    .map(name => ({ name, path: join(root, name) }))
    .filter(x => statSync(x.path).isDirectory() && existsSync(join(x.path, "state")));
}

// Round 2 only. The early phase is no longer re-globbed here: this file used to match
// /_phase_5_round1\.md$/ alone, which reported zero findings for a run whose earliest
// snapshot is phase_3 while extractHistoricalState read four such files from the same
// directory. Taking the early set from the extractor's own output removes the second,
// narrower copy of that glob rather than widening it.
function round2Findings(state) {
  const rows = [];
  for (const name of readdirSync(state).filter(n => /^reviewer_.*_phase_5_round2\.md$/.test(n)).sort()) {
    const text = readFileSync(join(state, name), "utf8");
    for (const f of extractFindingsFromMarkdown(text, inferPersona(name), name)) rows.push({ ...f, phase: "round2" });
  }
  return rows;
}

// The extractor prefers phase_3 and falls back to round 1, so the label has to come from
// the files it actually read. A phase_3 run has no round 1 and must not be called one.
function earlyPhaseLabel(sourceFiles) {
  const labels = [...new Set(sourceFiles.map(n => /_phase_3\.md$/.test(n) ? "phase_3" : /_phase_5_round1\.md$/.test(n) ? "phase_5_round1" : "unrecognised_phase"))];
  return labels.length === 1 ? labels[0] : labels.sort().join("+");
}

const emit = payload => process.stdout.write(JSON.stringify(payload, null, 2) + "\n");

function main() {
  const root = resolve(process.argv[2] ?? "docs/reviews");
  const envelope = { historical_comparison: true, root };
  let runs;
  try {
    runs = dirs(root);
  } catch (error) {
    // The likeliest failure is a mistyped path, and the runbook redirects stdout to a
    // file. A raw stack trace on stderr leaves that file empty.
    process.stderr.write(`adaptive-history-compare: cannot read archive root (${error?.code ?? "error"})\n`);
    emit({ ...envelope, root_status: "unavailable", error_type: error?.constructor?.name ?? "Error", run_count: 0, compared_count: 0, skipped_count: 0, rows: [] });
    process.exitCode = 1;
    return;
  }

  const rows = [];
  for (const run of runs) {
    const state = join(run.path, "state");
    try {
      const input = extractHistoricalState(state);
      if (!input.provenance.source_files.length) {
        // A run whose files use another phase or naming convention used to vanish here,
        // making "no archives" and "archives I could not read" the same output.
        rows.push({
          run: run.name,
          status: "skipped",
          reason: "no_reviewer_state_file_matched_expected_phase_glob",
          expected_files: EXPECTED_EARLY,
          state_files_present: readdirSync(state).sort(),
          provenance: input.provenance
        });
        continue;
      }
      const judgePath = join(state, JUDGE_FILE);
      const judge = existsSync(judgePath) ? parseJudgeRuling(readFileSync(judgePath, "utf8")) : { findings: [], coverage: null };
      rows.push({
        run: run.name,
        status: "compared",
        provenance: input.provenance,
        comparison: compareArchive({
          earlyFindings: input.findings,
          earlyPhase: earlyPhaseLabel(input.provenance.source_files),
          round2Findings: round2Findings(state),
          round2Present: input.provenance.historical_round2_present,
          judgeFindings: judge.findings,
          judgeCoverage: judge.coverage,
          judgeSourcePresent: input.provenance.historical_judge_present,
          shadow: decideAdaptiveShadow(input)
        })
      });
    } catch (error) {
      rows.push({ run: run.name, status: "unavailable", error_type: error?.constructor?.name ?? "Error" });
    }
  }

  emit({
    ...envelope,
    // run_count is directories seen. A skipped or unreadable run keeps a row, so a
    // partial archive can no longer report the same totals as an empty one.
    run_count: rows.length,
    compared_count: rows.filter(r => r.status === "compared").length,
    skipped_count: rows.filter(r => r.status !== "compared").length,
    rows
  });
}

main();
