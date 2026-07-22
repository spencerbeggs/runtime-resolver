# CLI Reference

The `runtime-resolver` CLI resolves semver-compatible versions of Node.js, Bun, and Deno runtimes. It prints the resolved version data as JSON to stdout and exits `0` on success. Usage errors and resolution failures print a short message to stderr and exit with a non-zero code, so scripts can branch on the exit status rather than parsing an envelope.

## Installation

Install globally or run directly with `npx`:

```bash
npm install -g runtime-resolver
```

```bash
npx runtime-resolver --node ">=20"
```

The runtime dependencies (`effect`, `@effected/runtimes`, `@effected/semver`) install automatically — there are no peer dependencies to add by hand.

## Options

| Flag | Description | Example |
| --- | --- | --- |
| `--node <range>` | Resolve Node.js versions matching a semver range | `--node ">=20"` |
| `--bun <range>` | Resolve Bun versions matching a semver range | `--bun ">=1.1"` |
| `--deno <range>` | Resolve Deno versions matching a semver range | `--deno ">=2"` |
| `--node-phases <phases>` | Comma-separated Node.js release phases | `--node-phases "current,active-lts"` |
| `--increments <type>` | Version granularity for all runtimes: `latest`, `minor`, or `patch` | `--increments minor` |
| `--node-default <version>` | Pin a default version for Node.js | `--node-default "20.19.0"` |
| `--bun-default <version>` | Pin a default version for Bun | `--bun-default "1.1.0"` |
| `--deno-default <version>` | Pin a default version for Deno | `--deno-default "2.0.0"` |
| `--node-date <date>` | ISO date for reproducible Node.js phase calculations | `--node-date "2024-01-15"` |
| `--pretty` | Pretty-print the JSON output | |
| `--offline` | Resolve from the bundled snapshot only; make no network requests | |
| `--token <token>` | GitHub personal access token for authentication | `--token "ghp_..."` |
| `--version` | Print the CLI version and exit | |
| `--help` | Print usage and exit | |

At least one of `--node`, `--bun`, or `--deno` is required. `--node-phases` and `--node-date` apply to Node.js only; `--increments` applies to every requested runtime.

### Increments

The `--increments` flag controls version granularity in the output for all requested runtimes (Node.js, Bun, and Deno):

- `latest` -- only the latest matching version per major line (default)
- `minor` -- one version per minor release
- `patch` -- every patch version

### Node.js Phases

The `--node-phases` flag accepts a comma-separated list of release phases to filter results. Valid phases:

- `current` -- the current release line
- `active-lts` -- actively maintained LTS releases
- `maintenance-lts` -- LTS releases in maintenance mode
- `end-of-life` -- releases that have reached end of life

An unrecognized phase is a usage error: the CLI prints the offending value and the accepted set to stderr and exits non-zero.

### Default Versions

The `--node-default`, `--bun-default`, and `--deno-default` flags pin a specific version for each runtime. The pinned version is included in the results even if it would otherwise be filtered out, and appears as the `default` field in that runtime's output.

For Node.js, when no `--node-default` is provided, the `default` field automatically reports the latest LTS version.

### Node.js Date

The `--node-date` flag accepts an ISO 8601 date string (e.g. `2024-01-15`). It overrides the reference date used for Node.js release phase calculations, enabling reproducible results.

### Offline Mode

The `--offline` flag forces snapshot-only resolution: every requested runtime resolves from the version data bundled with the package, and the CLI makes no requests to `nodejs.org` or the GitHub API. Results carry `source: "cache"`, so the output itself records that the answer came from the snapshot rather than a live feed.

Offline mode needs no credentials — because there is no network call to authenticate, `--offline` takes precedence over `--token` (and over the `GITHUB_PERSONAL_ACCESS_TOKEN` / `GITHUB_TOKEN` environment variables), which are simply ignored. This makes it a good fit for air-gapped or rate-limit-sensitive environments where a fixed, network-free answer is preferable to a live one.

```bash
runtime-resolver --bun ">=1" --deno ">=1" --offline
```

The bundled snapshot is only as current as the installed package version; upgrade `runtime-resolver` to refresh it.

## Output

The CLI emits the resolver's version data directly — no wrapper envelope, no `$schema` field.

Each runtime's result carries a `source` field indicating whether the data came from a live API fetch (`"api"`) or the bundled offline snapshot (`"cache"`), the matched `versions`, the highest match as `latest`, and — where applicable — `lts` (Node.js only) and `default`.

### Single runtime

When exactly one runtime is requested, its result is emitted directly:

```bash
runtime-resolver --node ">=20"
```

```json
{"source":"api","versions":["22.14.0","20.19.0"],"latest":"22.14.0","lts":"20.19.0","default":"20.19.0"}
```

### Multiple runtimes

When more than one runtime is requested, the output is an object keyed by runtime name, in the order the flags were given:

```bash
runtime-resolver --node ">=20" --bun ">=1" --pretty
```

```json
{
  "node": {
    "source": "api",
    "versions": ["22.14.0"],
    "latest": "22.14.0",
    "lts": "20.19.0",
    "default": "20.19.0"
  },
  "bun": {
    "source": "api",
    "versions": ["1.1.42"],
    "latest": "1.1.42"
  }
}
```

The `lts` field appears only for Node.js. The `default` field appears when a `--*-default` flag is set, or automatically for Node.js (latest LTS). `--pretty` switches from the compact default to 2-space indentation.

## Exit Codes and Errors

- **`0`** — every requested runtime resolved; the JSON result is on stdout.
- **non-zero** — a usage error (a missing runtime flag, or an invalid `--node-phases`/range value) or a resolution failure. A one-line `error: <message>` is written to stderr and stdout stays empty.

Resolution failures surface the resolver's typed errors:

| Condition | Example stderr message |
| --- | --- |
| Range matched nothing | `error: no bun version matched ">=99"` |
| Range matched nothing within the requested phases | `error: no node version matched ">=20" within phase(s) current` |
| Malformed semver range | `error: invalid node range: Invalid range expression: "x" at position 0` |
| Pinned default cannot be resolved | `error: no node version matched the requested default "0.0.1"` |

Because failures are signalled by exit status, scripts guard resolution with a plain status check rather than inspecting the payload:

```bash
if ! result=$(runtime-resolver --node ">=20"); then
  echo "resolution failed" >&2
  exit 1
fi
echo "$result" | jq -r '.latest'
```

## Usage with jq

The structured JSON output pairs well with `jq`. For a single requested runtime the fields are top-level; for several, index by runtime name:

```bash
# Latest Node.js version matching a range (single runtime → top-level fields)
runtime-resolver --node ">=20" | jq -r '.latest'

# All resolved Bun versions
runtime-resolver --bun ">=1" | jq '.versions'

# Node.js LTS when several runtimes are requested (keyed by runtime)
runtime-resolver --node ">=18" --deno ">=2" | jq -r '.node.lts'
```

## CI/CD Examples

### GitHub Actions

Use `runtime-resolver` in a workflow to build a dynamic version matrix:

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

The resolve step fails the job automatically if the range matches nothing, since the CLI exits non-zero.

### Shell Scripts

```bash
#!/usr/bin/env bash
set -euo pipefail

# A failed resolution exits non-zero, so `set -e` stops the script here.
RESULT=$(runtime-resolver --node ">=20" --pretty)

NODE_VERSION=$(echo "$RESULT" | jq -r '.latest')
echo "Using Node.js $NODE_VERSION"
```

## Authentication

Node.js versions come from `nodejs.org` and need no credentials. Bun and Deno versions come from the GitHub REST API, which is rate-limited to 60 requests per hour when unauthenticated — provide a token to raise that limit.

The CLI selects credentials in this order (first match wins):

1. **`--token` flag** — an explicit personal access token
2. **`GITHUB_PERSONAL_ACCESS_TOKEN`** environment variable
3. **`GITHUB_TOKEN`** environment variable
4. **Unauthenticated** — subject to 60 requests per hour

```bash
# Explicit token via flag
runtime-resolver --bun ">=1" --token "ghp_..."

# Or via environment variable
export GITHUB_TOKEN="ghp_..."
runtime-resolver --bun ">=1"
```

Credentials only matter for live lookups. With `--offline`, no request is made and none of these sources are consulted — see [Offline Mode](#offline-mode).

See [Authentication](./authentication.md) for details.
