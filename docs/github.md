# GitHub authentication and rate limits

Node.js versions come from `nodejs.org` and need no credentials. Bun and Deno versions come from the GitHub REST API, which is rate-limited to **60 requests per hour** when unauthenticated and **5,000 per hour** with a token. You only need a token when resolving `--bun` or `--deno` often enough to hit the anonymous limit — or you can skip the network entirely with [`--offline`](#offline-as-an-alternative-to-a-token).

## When you need a token

- **Resolving `--node` only** — no token, ever. Node.js release data is served by `nodejs.org`.
- **Resolving `--bun` or `--deno`** — reads the GitHub REST API. Works anonymously at 60 requests per hour; a token raises that to 5,000. No special scopes are required, since only public repository data is read.

## Token detection order

The CLI selects GitHub credentials in this order (first match wins):

1. **`--token` flag** — an explicit personal access token, overriding the environment
2. **`GITHUB_PERSONAL_ACCESS_TOKEN`** environment variable
3. **`GITHUB_TOKEN`** environment variable
4. **Anonymous** — no credentials, subject to the 60 requests per hour limit

### Token via environment

```bash
# Preferred — fine-grained PAT
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx

# Fallback — default GitHub token (e.g. in GitHub Actions)
export GITHUB_TOKEN=ghp_xxxx

runtime-resolver --bun ">=1"
```

`GITHUB_PERSONAL_ACCESS_TOKEN` is checked before `GITHUB_TOKEN`. If neither is set, requests are anonymous.

### Token via flag

Pass a token directly; it takes precedence over both environment variables:

```bash
runtime-resolver --bun ">=1" --token "ghp_xxxx"
```

## Offline as an alternative to a token

The `--offline` flag resolves every runtime from the snapshot bundled with the package and makes no network requests, so it needs no credentials at all. Because there is nothing to authenticate, `--offline` takes precedence over `--token` and over both environment variables, which are ignored. Results carry `source: "cache"`. This is a good fit for air-gapped or rate-limit-sensitive environments. See the [CLI reference](./cli.md#offline-mode) for details.

The resolver also falls back to the snapshot on its own when a live feed is unavailable — a rate-limit response, or no network. In that case it logs a warning to stderr naming the affected runtime, and the result's `source` field reads `"cache"` so you can always tell which path produced the data. The snapshot may be slightly stale but keeps CI and air-gapped environments working; upgrade `runtime-resolver` to refresh it.

## GitHub Actions

The built-in `GITHUB_TOKEN` secret is enough for most workflows that resolve Bun or Deno:

```yaml
- uses: actions/checkout@v7
- run: npx runtime-resolver --bun ">=1" --pretty
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Resolving only `--node` needs no token at all. For higher rate limits across many jobs, store a fine-grained personal access token as a repository secret and expose it as `GITHUB_PERSONAL_ACCESS_TOKEN`.

### Dynamic version matrix

Resolve a range in one job and feed the versions into a matrix in the next. The resolve step fails the job automatically if the range matches nothing, since the CLI exits non-zero:

```yaml
name: CI Matrix
on: [push]

jobs:
  resolve:
    runs-on: ubuntu-latest
    outputs:
      node-versions: ${{ steps.resolve.outputs.versions }}
    steps:
      - name: Resolve Node.js versions
        id: resolve
        run: |
          RESULT=$(npx runtime-resolver --node ">=20" --node-phases "current,active-lts")
          echo "versions=$(echo "$RESULT" | jq -c '.versions')" >> "$GITHUB_OUTPUT"

  test:
    needs: resolve
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ${{ fromJson(needs.resolve.outputs.node-versions) }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test
```

Resolving Node.js needs no token, so this matrix job runs anonymously. Add `--bun` or `--deno` and it will read the GitHub API — set `GITHUB_TOKEN` on the resolve step as shown above.
