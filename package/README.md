# aux4/cloud-find

Find the right aux4 command for a natural-language request. `aux4 find ask` builds a picture of your
own installed commands (help text only) and asks the aux4.cloud command finder to rank the best
match, without you ever holding a jev/TypeSafe API key yourself.

## Installation

```bash
aux4 aux4 pkger install aux4/cloud-find
```

## Quick Start

```bash
aux4 find ask "send a message to my team"
```

```text
91%  aux4 slack post (aux4/slack)
5%   aux4 slack list (aux4/slack)
```

If you have no active aux4 Cloud session (or the finder is unreachable), `aux4 find ask` falls back to
the local `aux4 aux4 pkger find` BM25 search automatically — you always get a result.

## How it works

1. **Build your tree.** `aux4 find ask` walks your own installed packages (the same manifests
   `aux4 --help` reads) and collects every non-private, non-profile-routing command's help text —
   never full man pages, and never anything from other users' installs.
2. **Fingerprint it.** A stable fingerprint of that tree is sent on every call. The service caches
   the last tree it saw per fingerprint, so the (often large) full tree is only re-sent when it
   actually changes.
3. **Ask.** The request is sent to the aux4-owned command finder machine, which walks (or, for
   small installs, flatly asks) with jev / TypeSafe System One and returns ranked candidates with
   confidence.
4. **Never a shared key.** The jev API key lives only on the finder machine. This package never
   sees it, stores it, or sends it anywhere.

## Configuration

| Variable | Purpose | Default |
|---|---|---|
| `AUX4_CLOUD_SCOPE` | Your own aux4 Cloud scope — billed for each query. | *(none)* |
| `AUX4_CLOUD_FIND_SCOPE` | The aux4-owned scope hosting the command finder machine. | `aux4` |
| `AUX4_CLOUD_FIND_MACHINE` | Name of the deployed command finder machine. | `pkger` |
| `AUX4_CLOUD_API_URL` | Cloud API base URL. | `https://api.aux4.cloud` |

## Metering

Each query records one `find-queries` unit against your `aux4/cloud-find` plan. An over-limit or
unentitled call is refused by the finder machine before any jev spend, and you'll see a clear error
rather than a partial or silently-billed result.

## Privacy note

Sending help-text labels to jev/TypeSafe is accepted for **dev only** today. A production ToS/opt-out
decision is still pending — see the CLS-015/CLS-017 items on the aux4 task ledger. Only your
commands' one-line help text ever leaves your machine — never full man pages, arguments, or
command output.
