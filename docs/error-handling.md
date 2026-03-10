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

All three resolvers (Node.js, Bun, and Deno) automatically retry with
exponential backoff (3 retries, starting at 1 second).

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

### InvalidInputError

Thrown when input parameters are invalid (for example, a malformed semver
range). All three resolvers -- Node.js, Bun, and Deno -- validate their inputs
and fail with `InvalidInputError` when a semver range or other option is
malformed.

| Field | Type | Description |
| --- | --- | --- |
| `field` | `string` | Name of the invalid parameter |
| `value` | `string` | The value that was rejected |
| `message` | `string` | Human-readable description |

### CacheError

Thrown when the version cache fails to read or write.

| Field | Type | Description |
| --- | --- | --- |
| `operation` | `"read"` or `"write"` | Which cache operation failed |
| `message` | `string` | Human-readable description |

### FreshnessError

Thrown when the requested freshness strategy cannot be satisfied. For example,
`freshness: "api"` fails with this error when the network is unavailable.

| Field | Type | Description |
| --- | --- | --- |
| `strategy` | `Freshness` | The freshness strategy that was set |
| `message` | `string` | Human-readable description |

## Error Unions by Runtime

Each resolver's error union includes all relevant error types:

- **Node.js**: `NetworkError | ParseError | RateLimitError | VersionNotFoundError | InvalidInputError | CacheError | FreshnessError`
- **Bun**: `NetworkError | ParseError | RateLimitError | VersionNotFoundError | InvalidInputError | CacheError | FreshnessError`
- **Deno**: `NetworkError | ParseError | RateLimitError | VersionNotFoundError | InvalidInputError | CacheError | FreshnessError`

## Promise API Error Handling

The Promise API (`resolveNode`, `resolveBun`, `resolveDeno`) surfaces errors
as standard rejected promises. Wrap calls in `try`/`catch`:

```typescript
import { resolveNode } from "runtime-resolver";

try {
  const result = await resolveNode({ semverRange: ">=20" });
  console.log(result.latest);
} catch (error) {
  // Errors surface as FiberFailure wrapping the tagged error
  console.error(error.message);
}
```

Invalid semver ranges are caught at input validation:

```typescript
try {
  // This will throw InvalidInputError
  await resolveNode({ semverRange: "not-valid-semver" });
} catch (error) {
  console.error(error.message); // Invalid semver range: "not-valid-semver"
}
```

## Effect API Error Handling

The Effect API exposes every error class so you can use `Effect.catchTag` for
precise discrimination:

```typescript
import {
  NodeResolver,
  NodeResolverLive,
  NetworkError,
  RateLimitError,
} from "runtime-resolver/effect";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver;
  return yield* resolver.resolve({ semverRange: ">=20" });
}).pipe(
  Effect.catchTag("NetworkError", (e) =>
    Effect.logWarning(`Network failed: ${e.url}`).pipe(
      Effect.flatMap(() => Effect.fail(e))
    )
  ),
  Effect.catchTag("RateLimitError", (e) =>
    Effect.logWarning(`Rate limited, retry after ${e.retryAfter}s`)
  ),
  Effect.catchTag("InvalidInputError", (e) =>
    Effect.logError(`Invalid ${e.field}: ${e.value}`)
  )
);
```

You can also match multiple error tags at once with `Effect.catchTags`:

```typescript
const safe = program.pipe(
  Effect.catchTags({
    NetworkError: (e) => Effect.succeed({ fallback: true, url: e.url }),
    ParseError: (e) => Effect.die(`Corrupt data from ${e.source}`),
  })
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
        "_tag": "RateLimitError",
        "message": "Rate limited",
        "limit": 60,
        "remaining": 0,
        "retryAfter": 30
      }
    }
  }
}
```

Invalid input is also reported through the error envelope:

```json
{
  "ok": false,
  "results": {
    "bun": {
      "ok": false,
      "error": {
        "_tag": "InvalidInputError",
        "message": "Invalid semver range: \"not-valid\"",
        "field": "semverRange",
        "value": "not-valid"
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
