#!/usr/bin/env node
// aux4/cloud-find "ask" (client subcommand) - the public client for the aux4.cloud command finder.
//
// Builds the command tree from the CALLER's own installed packages (help
// text only, private/profile-routing commands filtered), sends a
// fingerprint + the tree only on a cache miss, and calls the
// aux4/cloud-find-service machine through the aux4 Cloud run transport
// (`aux4 cloud pkger find`), which forwards only the command name plus
// one stdin body - never flags - so the whole request travels as JSON on
// stdin. Falls back to local `aux4 aux4 pkger find` when the caller has no
// cloud session or the service is unavailable.

import { execFileSync } from "node:child_process";
import { buildLocalTree } from "./build-tree.mjs";
import { fingerprintTree } from "./fingerprint.mjs";

function fail(message, exitCode = 1) {
  process.stderr.write(`${message}\n`);
  process.exit(exitCode);
}

function callerToken() {
  if (process.env.AUX4_CLOUD_TOKEN) return process.env.AUX4_CLOUD_TOKEN;
  try {
    return execFileSync("aux4", ["aux4", "token"], { encoding: "utf8" }).trim();
  } catch (e) {
    return "";
  }
}

function localFallback(query, reason) {
  process.stderr.write(`aux4/cloud-find: ${reason}, falling back to local search\n`);
  runLocalFind(query);
}

function callService({ findScope, findMachine, apiUrl }, requestBody) {
  const args = ["cloud"];
  if (findScope) args.push("--scope", findScope);
  if (apiUrl) args.push("--apiUrl", apiUrl);
  args.push(findMachine, "find");
  const stdout = execFileSync("aux4", args, {
    input: JSON.stringify(requestBody),
    encoding: "utf8"
  });
  return JSON.parse(stdout);
}

function formatCandidate(candidate) {
  const pkg = candidate.package ? ` (${candidate.package})` : "";
  return `${(candidate.confidence * 100).toFixed(0)}%  ${candidate.command}${pkg}`;
}

// Confidence tiers (CLS-016 /confidence.md calibration measurement):
// >=0.9 is trustworthy enough to show as a single answer; 0.5-0.9 is close
// enough to suggest as "did you mean" but not assert; below 0.5 the finder
// itself says so and falls back to the local BM25 results, same as a
// service error would.
function printCandidates(response, query, asJson) {
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

function runLocalFind(query) {
  try {
    execFileSync("aux4", ["aux4", "pkger", "find", "--query", query], { stdio: "inherit" });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

async function main() {
  const [query, findScope, findMachine, apiUrl, callerScope, asJsonFlag] = process.argv.slice(2);
  if (!query) fail("Error: query is required");

  const token = callerToken();
  if (!token) {
    localFallback(query, "no cloud session");
    return;
  }

  const tree = buildLocalTree();
  if (tree.length === 0) {
    localFallback(query, "no local commands found");
    return;
  }
  const fingerprint = fingerprintTree(tree);
  const asJson = asJsonFlag === "true";

  const target = { findScope, findMachine, apiUrl };

  let response;
  try {
    response = callService(target, { query, scope: callerScope, authToken: token, fingerprint });
    if (response.treeStatus === "required") {
      response = callService(target, { query, scope: callerScope, authToken: token, fingerprint, tree });
    }
  } catch (e) {
    localFallback(query, `service call failed (${e.message})`);
    return;
  }

  printCandidates(response, query, asJson);
}

main();
