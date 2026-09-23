import { createHash } from "node:crypto";

// Stable fingerprint over the caller's own command tree, so the server can
// cache it and only ask for the full tree again once it actually changes.
export function fingerprintTree(nodes) {
  const sorted = nodes
    .map((n) => ({ path: n.path, help: n.help || "" }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const hash = createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
  return `sha256:${hash}`;
}
