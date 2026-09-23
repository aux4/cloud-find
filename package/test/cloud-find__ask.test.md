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
