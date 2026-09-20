#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { extractHistoricalState } from "./adaptive-history-extractor.mjs";
import { decideAdaptiveShadow } from "./adaptive-orchestrator.mjs";

function collect(root) {
  const out = [];
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (!statSync(p).isDirectory()) continue;
    const state = join(p, "state");
    if (existsSync(state)) out.push({name, state});
  }
  return out;
}

const root = resolve(process.argv[2] ?? "docs/reviews");
const rows = [];
for (const run of collect(root)) {
  try {
    const extracted = extractHistoricalState(run.state);
    if (!extracted.provenance.source_files.length) continue;
    const decision = decideAdaptiveShadow(extracted);
    rows.push({
      run: run.name,
      provenance: extracted.provenance,
      extracted_finding_count: extracted.findings.length,
      extracted_personas: extracted.candidate_personas,
      shadow: decision
    });
  } catch (error) {
    rows.push({ run: run.name, status: "unavailable", error_type: error?.constructor?.name ?? "Error" });
  }
}
process.stdout.write(JSON.stringify({
  policy_version: "adaptive-v4-shadow-1",
  historical_replay: true,
  root,
  run_count: rows.length,
  rows
}, null, 2) + "\n");
