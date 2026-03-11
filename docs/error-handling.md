# Error Handling

## Overview

runtime-resolver uses typed errors built on Effect's `Data.TaggedError`. Every
error carries a `_tag` string discriminator, which allows precise pattern
matching in both the Effect API (`Effect.catchTag`) and the CLI JSON envelope
(`error._tag`).

## Error Types

### NetworkError

Thrown when an HTTP request fails or times out.

| Field | Type | Description |
| --- | --- | --- |
| `url` | `string` | The URL that failed |
| `status` | `number` (optional) | HTTP status code, if available |
| `message` | `string` | Human-readable description |

### RateLimitError

Thrown when the GitHub API rate limit is exceeded.

| Field | Type | Description |
| --- | --- | --- |
| `retryAfter` | `number` (optional) | Seconds until the limit resets |
| `limit` | `number` | Maximum requests allowed in the window |
| `remaining` | `number` | Requests remaining (typically `0`) |
| `message` | `string` | Human-readable description |

### ParseError

Thrown when upstream data fails schema validation.

| Field | Type | Description |
| --- | --- | --- |
| `source` | `string` | URL or identifier of the data source |
| `message` | `string` | Human-readable description |

### VersionNotFoundError

Thrown when no versions match the semver constraint.

| Field | Type | Description |
| --- | --- | --- |
| `runtime` | `string` | Runtime name (`node`, `bun`, or `deno`) |
| `constraint` | `string` | The semver range that produced no matches |
| `message` | `string` | Human-readable description |

### FreshnessError

Thrown when the `FreshNodeCacheLive` (or Bun/Deno equivalents) layer cannot
fetch data from the API. This error only surfaces when you explicitly use
a `Fresh*CacheLive` layer.

| Field | Type | Description |
| --- | --- | --- |
| `strategy` | `string` | The freshness strategy that was set |
| `message` | `string` | Human-readable description |

### AuthenticationError

Thrown when GitHub authentication fails. This includes invalid tokens (HTTP 401)
and GitHub App credential failures (invalid private key, no installations
found).

| Field | Type | Description |
| --- | --- | --- |
| `method` | `"token"` or `"app"` | Which authentication method failed |
| `message` | `string` | Human-readable description |

## Error Unions by Runtime

Each resolver's error type has been simplified to just `VersionNotFoundError`.
Network, parse, rate limit, and authentication errors are handled internally
by the cache layers:

- **Auto cache layers** catch `NetworkError` and `ParseError`, falling back to
  bundled defaults
- **Fresh cache layers** convert fetch failures to `FreshnessError`
- **Offline cache layers** never contact the network

Resolver error union: `VersionNotFoundError`

## Promise API Error Handling

The Promise API (`resolveNode`, `resolveBun`, `resolveDeno`) surfaces errors
as standard rejected promises. Wrap calls in `try`/`catch`:

```typescript
import { resolveNode } from "runtime-resolver";

try {
  const result = await resolveNode({ semverRange: ">=20" });
  console.log(result.latest);
} catch (error) {
  console.error(error.message);
}
```

## Effect API Error Handling

The Effect API exposes every error class so you can use `Effect.catchTag` for
precise discrimination:

```typescript
import { NodeResolver } from "runtime-resolver/effect";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver;
  return yield* resolver.resolve({ semverRange: ">=20" });
}).pipe(
  Effect.catchTag("VersionNotFoundError", (e) =>
    Effect.succeed({ versions: [], latest: "none", constraint: e.constraint }),
  ),
);
```

## CLI Error Handling

The CLI always exits with code 0. Errors are encoded in the JSON response
envelope. The top-level `ok` field is `false` when any runtime fails, and
each runtime entry in `results` carries its own `ok` field:

```json
{
  "ok": false,
  "results": {
    "node": {
      "ok": false,
      "error": {
        "_tag": "VersionNotFoundError",
        "message": "No versions match constraint",
        "runtime": "node",
        "constraint": ">=99"
      }
    }
  }
}
```

Check the `ok` field at either level for programmatic use. To exit non-zero on
failure from a shell script, pipe through `jq`:

```bash
runtime-resolver --node ">=20" | jq -e '.ok' > /dev/null
```

Per-runtime status can be inspected individually:

```bash
runtime-resolver --node ">=20" --bun ">=1" \
  | jq -e '.results.node.ok' > /dev/null
```
