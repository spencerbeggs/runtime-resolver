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
| `--node-increments <type>` | Version granularity: `latest`, `minor`, or `patch` | `--node-increments minor` |
| `--pretty` | Pretty-print the JSON output | |
| `--schema` | Print the JSON Schema for the response format and exit | |
| `--version` | Print the CLI version and exit | |

### Node.js Phases

The `--node-phases` flag accepts a comma-separated list of release phases to
filter results. Valid phases:

- `current` -- the current release line
- `active-lts` -- actively maintained LTS releases
- `maintenance-lts` -- LTS releases in maintenance mode
- `end-of-life` -- releases that have reached end of life

### Node.js Increments

The `--node-increments` flag controls version granularity in the output:

- `latest` -- only the latest matching version per major line
- `minor` -- one version per minor release
- `patch` -- every patch version (default behavior)

## Response Format

### Success Response

When all requested runtimes resolve successfully, `ok` is `true`:

```json
{
  "$schema": "https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json",
  "ok": true,
  "results": {
    "node": {
      "ok": true,
      "versions": ["22.14.0", "20.19.0"],
      "latest": "22.14.0",
      "lts": "20.19.0"
    }
  }
}
```

The `lts` field appears only for Node.js results. The `default` field appears
only for Deno results.

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

### No Runtimes Requested

When no runtime flags are provided, the CLI writes an error envelope to stderr
with an empty `results` map:

```json
{
  "$schema": "https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json",
  "ok": false,
  "results": {}
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
