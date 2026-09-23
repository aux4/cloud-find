#### Description

`ask` builds the command tree from your own installed aux4 packages (help text only — private
commands and pure profile-routing commands are filtered out, and long help text is capped) and
sends it, along with your query, to the aux4.cloud command finder machine. Returns ranked command
candidates with confidence.

- Only a fingerprint of your tree is sent on most calls; the full tree is only re-sent when the
  finder's server-side cache doesn't recognize the fingerprint.
- If you have no active aux4 Cloud session, or the finder machine call fails for any reason, `ask`
  falls back to the local `aux4 aux4 pkger find` BM25 search automatically.
- The jev / TypeSafe API key never reaches this package — it lives only on the finder machine.
- Each successful query is metered against your `aux4/cloud-find` plan's `find-queries` counter. An
  over-limit or unentitled account is refused before any jev call is made.

#### Usage

```bash
aux4 find ask "<query>" [--findScope <scope>] [--findMachine <name>] [--apiUrl <url>] [--json true|false]
```

--query          What you want to do, in natural language (positional)
--findScope      aux4-owned scope hosting the command finder machine (default: `aux4`)
--findMachine    Name of the deployed command finder machine (default: `cloud-find`)
--apiUrl         Cloud API base URL (default: `https://api.aux4.cloud`)
--scope          Your own aux4 Cloud scope, billed for the query (env: `AUX4_CLOUD_SCOPE`)
--json           Print raw JSON instead of a formatted list (default: `false`)

#### Example

```bash
aux4 find ask "send a message to my team"
```

```text
91%  aux4 slack post (aux4/slack)
5%   aux4 slack list (aux4/slack)
```

```bash
aux4 find ask "send a message to my team" --json true
```

```json
{"candidates":[{"command":"aux4 slack post","confidence":0.91,"package":"aux4/slack"}],"usedFlat":true,"treeStatus":"cached"}
```
