// Builds the flat command tree from the user's OWN installed packages.
// Reads every ~/.aux4.config/packages/<scope>/<name>/.aux4 file, walks
// profiles/commands (following profile: routing) and returns a flat list of
// {path, help, parent, package}. Filters out private commands and pure
// profile-routing commands (whose only job is `profile:x`), caps help text
// length, and matches CLS-015's measured filter: help text only, no man pages.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const HELP_CAP = 200;

function aux4HomeDir() {
  return process.env.AUX4_HOME_DIR || join(homedir(), ".aux4.config");
}

function listInstalledManifests() {
  const packagesDir = join(aux4HomeDir(), "packages");
  const manifests = [];
  let scopes = [];
  try {
    scopes = readdirSync(packagesDir);
  } catch (e) {
    return manifests;
  }
  for (const scope of scopes) {
    const scopeDir = join(packagesDir, scope);
    let names = [];
    try {
      if (!statSync(scopeDir).isDirectory()) continue;
      names = readdirSync(scopeDir);
    } catch (e) {
      continue;
    }
    for (const name of names) {
      const manifestPath = join(scopeDir, name, ".aux4");
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
        manifests.push({ scope, name, manifest });
      } catch (e) {
        // not a package dir, or unreadable manifest - skip
      }
    }
  }
  return manifests;
}

function isRoutingOnly(command) {
  if (!Array.isArray(command.execute) || command.execute.length !== 1) return false;
  return /^profile:/.test(command.execute[0]);
}

function truncate(text) {
  if (!text) return text;
  return text.length > HELP_CAP ? text.slice(0, HELP_CAP) : text;
}

// Builds the flat node list for ONE manifest, walking every profile
// reachable from "main" through profile: routing, so the tree mirrors what
// a user actually sees under `aux4 <command>`.
function walkManifest(manifest, packageId) {
  const profilesByName = new Map();
  for (const profile of manifest.profiles || []) {
    profilesByName.set(profile.name, profile);
  }

  const nodes = [];
  const seenProfiles = new Set();

  function walkProfile(profileName, parentPath) {
    if (seenProfiles.has(profileName)) return; // guard against cycles
    seenProfiles.add(profileName);
    const profile = profilesByName.get(profileName);
    if (!profile) return;

    for (const command of profile.commands || []) {
      if (command.private) continue;
      const path = parentPath ? `${parentPath} ${command.name}` : command.name;

      if (isRoutingOnly(command)) {
        const nextProfile = command.execute[0].replace(/^profile:/, "");
        walkProfile(nextProfile, path);
        continue;
      }

      nodes.push({
        path: `aux4 ${path}`,
        help: truncate(command.help && command.help.text),
        parent: parentPath ? `aux4 ${parentPath}` : "",
        package: packageId
      });
    }
  }

  walkProfile("main", "");
  return nodes;
}

export function buildLocalTree() {
  const manifests = listInstalledManifests();
  const allNodes = [];
  const branchPaths = new Set();

  for (const { scope, name, manifest } of manifests) {
    const packageId = `${scope}/${name}`;
    const nodes = walkManifest(manifest, packageId);
    for (const node of nodes) {
      allNodes.push(node);
      if (node.parent) branchPaths.add(node.parent);
    }
  }

  // Synthesize branch nodes (one per distinct parent path) so the tree has
  // navigable non-leaf entries too, each labeled with its own path segment
  // since branch commands aren't installed commands themselves.
  const existingPaths = new Set(allNodes.map((n) => n.path));
  for (const branchPath of branchPaths) {
    if (existingPaths.has(branchPath)) continue;
    const segments = branchPath.split(" ");
    const parent = segments.slice(0, -1).join(" ");
    allNodes.push({
      path: branchPath,
      help: segments[segments.length - 1],
      parent: parent === "aux4" ? "" : parent
    });
    existingPaths.add(branchPath);
  }

  return allNodes;
}
