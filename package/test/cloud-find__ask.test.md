# find ask

## service unreachable or caller not entitled

Deterministic regardless of the local machine's own aux4 Cloud login state:
AUX4_CLOUD_TOKEN is set to a garbage value so `aux4 cloud-find`'s token
resolution never falls through to a real `aux4 aux4 token` lookup, and the
downstream `aux4 cloud ... ask` call always fails the same way.

### should fall back to local search instead of failing

```execute
AUX4_CLOUD_TOKEN=not-a-real-token aux4 find ask "install a package"
```

```error:partial
aux4/cloud-find: ** falling back to local search
```

```expect:partial
"command"*?
```

## confidence-tiered presentation (debug-present, no cloud call)

```file:req-high.json
{"response": {"candidates": [{"command": "aux4 browser screenshot", "confidence": 0.97, "package": "aux4/browser"}]}, "query": "take a screenshot"}
```

```file:req-medium.json
{"response": {"candidates": [{"command": "aux4 backup run", "confidence": 0.88, "package": "aux4/backup"}, {"command": "aux4 backup register", "confidence": 0.14, "package": "aux4/backup"}, {"command": "aux4 backup jobs list", "confidence": 0.0, "package": "aux4/backup"}]}, "query": "back up a sqlite database"}
```

```file:req-low.json
{"response": {"candidates": [{"command": "aux4 agent start", "confidence": 0.2, "package": "agent/agent"}]}, "query": "make the thing work better somehow"}
```

### should show a single answer at confidence >= 0.9

```execute
cat req-high.json | aux4 find debug-present
```

```expect
97%  aux4 browser screenshot (aux4/browser)
```

### should show a did-you-mean top 3 at confidence 0.5-0.9

```execute
cat req-medium.json | aux4 find debug-present
```

```expect
Not sure - did you mean:
  88%  aux4 backup run (aux4/backup)
  14%  aux4 backup register (aux4/backup)
  0%  aux4 backup jobs list (aux4/backup)
```

### should say it's unsure and fall back to local search below confidence 0.5

```execute
cat req-low.json | aux4 find debug-present
```

```error:partial
aux4/cloud-find: unsure, falling back to local search
```

```expect:partial
"command"*?
```
