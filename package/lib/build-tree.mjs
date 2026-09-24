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
// a user actually sees under `aux4 <command>`. `branchInfo` is filled in
// (path -> {help, packageId}) for every routing-only command encountered,
// since those commands are never emitted as leaf nodes themselves but often
// DO carry real help text worth keeping for the synthesized branch node.
function walkManifest(manifest, packageId, branchInfo) {
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
        const fullPath = `aux4 ${path}`;
        const help = command.help && command.help.text;
        if (help && help.trim() && help.trim() !== command.name) {
          branchInfo.set(fullPath, { help, packageId });
        } else if (!branchInfo.has(fullPath)) {
          branchInfo.set(fullPath, { help: null, packageId });
        }
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
  const branchInfo = new Map(); // path -> {help, packageId}
  const packageDescriptions = new Map(); // packageId -> description

  for (const { scope, name, manifest } of manifests) {
    const packageId = `${scope}/${name}`;
    if (manifest.description) packageDescriptions.set(packageId, manifest.description);
    const nodes = walkManifest(manifest, packageId, branchInfo);
    for (const node of nodes) {
      allNodes.push(node);
      if (node.parent) branchPaths.add(node.parent);
    }
  }

  // Synthesize branch nodes (one per distinct parent path) so the tree has
  // navigable non-leaf entries too - these are profile-routing commands,
  // not installed leaf commands, so their label comes from (in order):
  // (1) the routing command's own help text, when it's real (not empty and
  // not just its own command name - many routing commands only have
  // "text": "<name>", which is useless as a Choice label per CLS-015's
  // measured finding); (2) the owning package's .aux4 `description` field -
  // the same source `aux4 --help` one-liners come from; (3) the bare path
  // segment as a last resort so a node always has SOME label.
  const existingPaths = new Set(allNodes.map((n) => n.path));
  for (const branchPath of branchPaths) {
    if (existingPaths.has(branchPath)) continue;
    const segments = branchPath.split(" ");
    const parent = segments.slice(0, -1).join(" ");
    const info = branchInfo.get(branchPath);
    const help =
      (info && info.help) ||
      (info && packageDescriptions.get(info.packageId)) ||
      segments[segments.length - 1];
    allNodes.push({
      path: branchPath,
      help: truncate(help),
      parent: parent === "aux4" ? "" : parent,
      package: info && info.packageId
    });
    existingPaths.add(branchPath);
  }

  return allNodes;
}
