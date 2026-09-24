#!/usr/bin/env node
// TEST-ONLY entry point: reads {"response": <finder response>, "query": "...", "json": bool}
// from stdin and calls the real printCandidates() on it - no cloud/network
// call involved. Lets the confidence-tier logic in present.mjs be exercised
// through `aux4 <command>` (per aux4-test convention) with a fully stubbed
// response, instead of only reachable via a live service call.
import { readFileSync } from "node:fs";
import { printCandidates } from "./present.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
printCandidates(input.response, input.query, Boolean(input.json));
