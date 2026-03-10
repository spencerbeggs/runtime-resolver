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
| `--pretty` | Pretty-print the JSON output | |
| `--schema` | Print the JSON Schema for the response format and exit | |
| `--version` | Print the CLI version and exit | |

### Increments

The `--increments` flag controls version granularity in the output for all
requested runtimes (Node.js, Bun, and Deno):

- `latest` -- only the latest matching version per major line (default)
- `minor` -- one version per minor release
- `patch` -- every patch version

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

The CLI uses the GitHub API to fetch runtime version data. To avoid rate
limiting, set one of the following environment variables:

- `GITHUB_PERSONAL_ACCESS_TOKEN` (checked first)
- `GITHUB_TOKEN`

```bash
export GITHUB_TOKEN="ghp_..."
runtime-resolver --node ">=20"
```

When neither variable is set, the CLI falls back to unauthenticated requests.
Unauthenticated requests are subject to stricter rate limits (60 requests per
hour). If version data has been cached locally, the CLI uses cached results when
the API is unavailable.
