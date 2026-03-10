# CLI Reference

The `runtime-resolver` CLI resolves semver-compatible versions of Node.js, Bun,
and Deno runtimes. It outputs structured JSON to stdout and always exits with
code 0. Errors are encoded in the JSON response envelope rather than signaled
through exit codes. Every response includes a `$schema` property pointing to the
published JSON Schema.

## Installation

Install globally or run directly with `npx`:

```bash
npm install -g runtime-resolver
```

```bash
npx runtime-resolver --node ">=20"
```

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
| `--freshness <strategy>` | Data freshness strategy: `auto`, `api`, or `cache` | `--freshness cache` |
| `--pretty` | Pretty-print the JSON output | |
| `--token <token>` | GitHub personal access token for authentication | `--token "ghp_..."` |
| `--app-id <id>` | GitHub App ID for app authentication | `--app-id "123456"` |
| `--app-private-key <key>` | GitHub App private key (literal or `@/path/to/key.pem`) | `--app-private-key @key.pem` |
| `--app-installation-id <id>` | GitHub App installation ID (auto-discovered if omitted) | `--app-installation-id "789"` |
| `--schema` | Print the JSON Schema for the response format and exit | |
| `--version` | Print the CLI version and exit | |

### Increments

The `--increments` flag controls version granularity in the output for all
requested runtimes (Node.js, Bun, and Deno):

- `latest` -- only the latest matching version per major line (default)
- `minor` -- one version per minor release
- `patch` -- every patch version

### Freshness

The `--freshness` flag controls how version data is fetched:

- `auto` -- Try the API first, fall back to the bundled cache on network
  failure. This is the default.
- `api` -- Require fresh data from the API. Fails with a `FreshnessError` if
  the network is unavailable.
- `cache` -- Use the bundled cache only, skipping all network requests.

```bash
# Require live data in CI
runtime-resolver --node ">=20" --freshness api

# Offline mode -- never contact the network
runtime-resolver --node ">=20" --freshness cache
```

### Authentication Flags

The `--token`, `--app-id`, `--app-private-key`, and `--app-installation-id`
flags provide explicit authentication, overriding any environment variables.

**Token authentication:**

```bash
runtime-resolver --node ">=20" --token "ghp_..."
```

**GitHub App authentication:**

```bash
# With literal private key
runtime-resolver --node ">=20" --app-id "123456" --app-private-key "-----BEGIN RSA..."

# With private key from file (@ prefix)
runtime-resolver --node ">=20" --app-id "123456" --app-private-key @/path/to/key.pem

# With explicit installation ID
runtime-resolver --node ">=20" --app-id "123456" --app-private-key @key.pem --app-installation-id "789"
```

**Validation rules:**

- `--token` and `--app-id`/`--app-private-key` are mutually exclusive
- `--app-id` and `--app-private-key` must both be provided
- `--app-installation-id` requires `--app-id` and `--app-private-key`
- Auth flags cannot be combined with `--schema`

### Schema Validation

The `--schema` flag prints the JSON Schema for the response format and exits.
It cannot be combined with any resolve flags (`--node`, `--bun`, `--deno`,
`--freshness`, `--increments`, `--node-phases`, `--node-default`,
`--bun-default`, `--deno-default`, `--node-date`). If `--schema` is used
alongside any of these flags, the CLI prints an error and exits:

```bash
# Valid: print the schema
runtime-resolver --schema

# Invalid: --schema with resolve flags
runtime-resolver --schema --node ">=20"
# Error: --schema cannot be combined with resolve flags (--node, --bun, --deno, etc.)
```

### Node.js Phases

The `--node-phases` flag accepts a comma-separated list of release phases to
filter results. Valid phases:

- `current` -- the current release line
- `active-lts` -- actively maintained LTS releases
- `maintenance-lts` -- LTS releases in maintenance mode
- `end-of-life` -- releases that have reached end of life

### Default Versions

The `--node-default`, `--bun-default`, and `--deno-default` flags pin a
specific version for each runtime. The pinned version is included in the
results even if it would otherwise be filtered out. It appears as the `default`
field in the response.

For Node.js, when no `--node-default` is provided, the `default` field
automatically reports the latest LTS version.

### Node.js Date

The `--node-date` flag accepts an ISO 8601 date string (e.g. `2024-01-15`). It
overrides the reference date used for Node.js release phase calculations,
enabling reproducible results.

### Empty Invocation

When no runtime flags (`--node`, `--bun`, `--deno`) are provided, the CLI
prints a help message to stderr instead of producing JSON output.

## Response Format

### Success Response

When all requested runtimes resolve successfully, `ok` is `true`. Each runtime
result includes a `source` field indicating whether data came from a live API
fetch (`"api"`) or the bundled build-time cache (`"cache"`):

```json
{
  "$schema": "https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json",
  "ok": true,
  "results": {
    "node": {
      "ok": true,
      "source": "api",
      "versions": ["22.14.0", "20.19.0"],
      "latest": "22.14.0",
      "lts": "20.19.0",
      "default": "20.19.0"
    }
  }
}
```

The `lts` field appears only for Node.js results. The `default` field appears
when a `--*-default` flag is set, or automatically for Node.js (latest LTS).

### Partial Failure

When some runtimes succeed and others fail, the top-level `ok` is `false` but
successful results are still included:

```json
{
  "$schema": "https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json",
  "ok": false,
  "results": {
    "node": {
      "ok": true,
      "source": "api",
      "versions": ["22.14.0"],
      "latest": "22.14.0"
    },
    "bun": {
      "ok": false,
      "error": {
        "_tag": "RateLimitError",
        "message": "Rate limited",
        "limit": 60,
        "remaining": 0
      }
    }
  }
}
```

### Error Types

Each error object carries a `_tag` field identifying its type, a `message`
field, and additional metadata specific to the error:

| Error Tag | Description | Extra Fields |
| --- | --- | --- |
| `NetworkError` | HTTP request failed | `url`, `status` |
| `RateLimitError` | GitHub API rate limit exceeded | `limit`, `remaining`, `retryAfter` |
| `ParseError` | Upstream data could not be parsed | `source` |
| `VersionNotFoundError` | No versions match the given range | `runtime`, `constraint` |
| `InvalidInputError` | Invalid semver range or option value | `field`, `value` |
| `FreshnessError` | Freshness strategy cannot be satisfied | `strategy` |
| `AuthenticationError` | Authentication failed | `method` |

## Usage with jq

The structured JSON output pairs well with `jq` for scripting:

```bash
# Get the latest Node.js version matching a range
runtime-resolver --node ">=20" | jq -r '.results.node.latest'

# Get all resolved Bun versions as an array
runtime-resolver --bun ">=1" | jq '.results.bun.versions'

# Check whether resolution succeeded
runtime-resolver --node ">=20" | jq '.ok'

# Get the LTS version for Node.js
runtime-resolver --node ">=18" | jq -r '.results.node.lts'

# Check data source (api vs cache)
runtime-resolver --node ">=20" | jq -r '.results.node.source'
```

## JSON Schema

The response format is described by a published JSON Schema. Use it for
validation in editors, CI checks, or code generation:

```bash
# Dump the schema to a local file
runtime-resolver --schema > schema.json
```

The schema is also available at:

```text
https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json
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
          echo "versions=$(echo "$RESULT" | jq -c '.results.node.versions')" >> "$GITHUB_OUTPUT"

  test:
    needs: resolve
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ${{ fromJson(needs.resolve.outputs.node-versions) }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci && npm test
```

### Shell Scripts

Guard against resolution failures by checking the `ok` field:

```bash
#!/usr/bin/env bash
set -euo pipefail

RESULT=$(runtime-resolver --node ">=20" --pretty)
OK=$(echo "$RESULT" | jq -r '.ok')

if [ "$OK" != "true" ]; then
  echo "Resolution failed:" >&2
  echo "$RESULT" | jq '.results' >&2
  exit 1
fi

NODE_VERSION=$(echo "$RESULT" | jq -r '.results.node.latest')
echo "Using Node.js $NODE_VERSION"
```

## Authentication

The CLI detects GitHub credentials automatically using this priority chain
(first match wins):

1. **CLI flags** -- `--token` or `--app-id` + `--app-private-key`
2. **App env vars** -- `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`
3. **Token env vars** -- `GITHUB_PERSONAL_ACCESS_TOKEN`, then `GITHUB_TOKEN`
4. **Unauthenticated** -- subject to 60 requests per hour

```bash
# Explicit token via flag
runtime-resolver --node ">=20" --token "ghp_..."

# Or via environment variable
export GITHUB_TOKEN="ghp_..."
runtime-resolver --node ">=20"
```

When multiple credential sources are detected (for example, both app env vars
and token env vars are set), a warning is emitted to stderr indicating which
source was selected. No warning when CLI flags are provided -- explicit flags
are unambiguous.
