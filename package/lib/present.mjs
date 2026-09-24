// Confidence-tiered presentation of a finder response (CLS-016
// /confidence.md calibration measurement): >=0.9 is trustworthy enough to
// show as a single answer; 0.5-0.9 is close enough to suggest as "did you
// mean" but not assert; below 0.5 the finder itself says so and falls back
// to the local BM25 results, same as a real service error would.
//
// Split out from client.mjs so it's independently testable (aux4-command's
// debug-present entry point below feeds it a stubbed response over stdin,
// with no real cloud/network call involved) rather than only reachable
// through the full `ask` -> cloud call -> present pipeline.

import { execFileSync } from "node:child_process";

export function formatCandidate(candidate) {
  const pkg = candidate.package ? ` (${candidate.package})` : "";
  return `${(candidate.confidence * 100).toFixed(0)}%  ${candidate.command}${pkg}`;
}

export function runLocalFind(query) {
  try {
    execFileSync("aux4", ["aux4", "pkger", "find", "--query", query], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

export function printCandidates(response, query, asJson) {
  if (asJson) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
    return;
  }
  const candidates = response.candidates || [];
  const top = candidates[0];
  if (!top) {
    process.stdout.write("No matching command found.\n");
    return;
  }
  if (top.confidence >= 0.9) {
    process.stdout.write(`${formatCandidate(top)}\n`);
    return;
  }
  if (top.confidence >= 0.5) {
    process.stdout.write("Not sure - did you mean:\n");
    for (const candidate of candidates.slice(0, 3)) {
      process.stdout.write(`  ${formatCandidate(candidate)}\n`);
    }
    return;
  }
  process.stderr.write("aux4/cloud-find: unsure, falling back to local search\n");
  runLocalFind(query);
}
