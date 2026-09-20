#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decideAdaptiveShadow } from "./adaptive-orchestrator.mjs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node scripts/adaptive-shadow.mjs <private-input.json>");
  process.exit(2);
}
try {
  const input = JSON.parse(readFileSync(path, "utf8"));
  process.stdout.write(JSON.stringify(decideAdaptiveShadow(input), null, 2) + "\n");
} catch (error) {
  // Never print the private input or exception body.
  console.error(JSON.stringify({ status: "unavailable", error_type: error?.constructor?.name ?? "Error", executes_panel: false }));
  process.exit(2);
}
