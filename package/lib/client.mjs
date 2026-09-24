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
import { printCandidates, runLocalFind } from "./present.mjs";

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
