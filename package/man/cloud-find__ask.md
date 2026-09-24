#### Description

`ask` builds the command tree from your own installed aux4 packages (help text only — private
commands and pure profile-routing commands are filtered out, and long help text is capped) and
sends it, along with your query, to the aux4.cloud command finder machine — `aux4 cloud pkger find`
under the hood, in the `aux4`-owned scope. Returns ranked command candidates with confidence.

- Only a fingerprint of your tree is sent on most calls; the full tree is only re-sent when the
  finder's server-side cache doesn't recognize the fingerprint.
- If you have no active aux4 Cloud session, or the finder machine call fails for any reason, `ask`
  falls back to the local `aux4 aux4 pkger find` BM25 search automatically.
- The jev / TypeSafe API key never reaches this package — it lives only on the finder machine.
- aux4/cloud-find is included with an active aux4 Cloud subscription — there is no separate
  metered purchase. An unentitled scope is refused before any jev call is made.
- Output is tiered by confidence: `>=90%` shows the single best command; `50-89%` shows "Not sure -
  did you mean:" with the top 3 candidates; `<50%` says it's unsure and falls back to the local
  `aux4 aux4 pkger find` results, the same as a service error would.

#### Usage

```bash
aux4 find ask "<query>" [--findScope <scope>] [--findMachine <name>] [--apiUrl <url>] [--json true|false]
```

--query          What you want to do, in natural language (positional)
--findScope      aux4-owned scope hosting the command finder machine (default: `aux4`)
--findMachine    Name of the deployed command finder machine (default: `pkger`)
--apiUrl         Cloud API base URL (default: `https://api.aux4.cloud`)
--scope          Your own aux4 Cloud scope (must have an active aux4 Cloud subscription; env: `AUX4_CLOUD_SCOPE`)
--json           Print the full ranked candidate list with confidences as JSON, instead of the tiered presentation (default: `false`)

#### Example

```bash
aux4 find ask "send a message to my team"
```

```text
94%  aux4 slack post (aux4/slack)
```

```bash
aux4 find ask "which command handles slack or email, not sure which"
```

```text
Not sure - did you mean:
  62%  aux4 slack post (aux4/slack)
  48%  aux4 email send (aux4/email)
  31%  aux4 slack dm open (aux4/slack)
```

```bash
aux4 find ask "send a message to my team" --json true
```

```json
{"candidates":[{"command":"aux4 slack post","confidence":0.94,"package":"aux4/slack"}],"usedFlat":true,"treeStatus":"cached"}
```
