# Authentication

## Overview

`runtime-resolver` reads Node.js versions from `nodejs.org`, which needs no credentials. Bun and Deno versions come from the GitHub REST API, which is rate-limited to **60 requests per hour** when unauthenticated and **5,000 per hour** with a token. When a request is rate-limited or the network is unavailable, the resolver falls back to a bundled offline snapshot and logs a warning to stderr.

You only need a token when resolving `--bun` or `--deno` frequently enough to hit the anonymous limit.

## Detection Order

The CLI selects GitHub credentials in this order (first match wins):

1. **`--token` flag** — an explicit personal access token, overriding the environment
2. **`GITHUB_PERSONAL_ACCESS_TOKEN`** environment variable
3. **`GITHUB_TOKEN`** environment variable
4. **Unauthenticated** — no credentials, subject to the 60 req/hr limit

No special scopes are required — only public repository data is read.

## Token via Environment

```bash
# Preferred — fine-grained PAT
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx

# Fallback — default GitHub token (e.g. in GitHub Actions)
export GITHUB_TOKEN=ghp_xxxx

runtime-resolver --bun ">=1"
```

`GITHUB_PERSONAL_ACCESS_TOKEN` is checked before `GITHUB_TOKEN`. If neither is set, requests are unauthenticated.

## Token via Flag

Pass a token directly; it takes precedence over both environment variables:

```bash
runtime-resolver --bun ">=1" --token "ghp_xxxx"
```

## Offline Fallback

When a live feed is unavailable — a rate-limit response, or no network — the resolver serves a bundled snapshot generated when the package was published, and logs a warning naming the affected runtime. The result's `source` field reads `"cache"` in that case (versus `"api"` for a live fetch), so you can always tell which path produced the data. The snapshot may be slightly stale but keeps CI and air-gapped environments working.

## GitHub Actions

The built-in `GITHUB_TOKEN` secret is enough for most workflows that resolve Bun or Deno:

```yaml
- uses: actions/checkout@v7
- run: npx runtime-resolver --bun ">=1" --pretty
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Resolving only `--node` needs no token at all. For higher rate limits across many jobs, store a fine-grained personal access token as a repository secret and expose it as `GITHUB_PERSONAL_ACCESS_TOKEN`.
