# Freshness Control & CLI Flag Validation Design

**Goal:** Add a `freshness` option that controls whether resolvers fetch from the API, use bundled cache, or auto-fallback. Add strict CLI flag validation to prevent invalid flag combinations.

**Date:** 2026-03-10

## Freshness Control

### `Freshness` type

`"auto" | "api" | "cache"`

- **`auto`** (default): Try API, gracefully fall back to bundled cache on network failure. Current behavior.
- **`api`**: Require fresh data from the API. If the network fails, fail with `FreshnessError` instead of falling back to cache.
- **`cache`**: Use bundled cache only. Skip all network requests entirely.

### Where it lives

Add `freshness?: Freshness` to each resolver's options (`BunResolverOptions`, `DenoResolverOptions`, `NodeResolverOptions`). The fetch-then-fallback logic in each resolver layer (`fetchBunTags`, `fetchDenoTags`, `fetchWithCacheFallback`) honors the strategy.

### New error

`FreshnessError` extends `Data.TaggedError("FreshnessError")` with `{ strategy: Freshness; message: string }`. Added to all three resolver error unions. Surfaced when `freshness: "api"` is set but the network is unavailable.

### How freshness changes each resolver layer

Current flow (`fetchBunTags` and equivalents):

```
API call -> tap(cache.set) -> map({source: "api"})
  catchTag("NetworkError") -> cache.get -> {source: "cache"}
  catchTag("CacheError") -> {tags: [], source: "cache"}
```

With freshness:

- **`"auto"`**: No change. Current flow.
- **`"api"`**: Remove the `catchTag("NetworkError")` fallback. Catch `NetworkError` and re-throw as `FreshnessError({ strategy: "api", message: "..." })`.
- **`"cache"`**: Skip the API call entirely. Go straight to `cache.get()`.

### Promise API

```typescript
const result = await resolveBun({ freshness: "cache" });
// result.source === "cache"

const result = await resolveNode({ freshness: "api" });
// result.source === "api" — or throws FreshnessError
```

### CLI

`--freshness auto|api|cache` global flag, validated before resolution (same pattern as `--increments`).

## CLI Flag Validation

`--schema` is incompatible with everything except `--pretty`. If combined with any resolve flag (`--node`, `--bun`, `--deno`, `--freshness`, `--increments`, `--node-phases`, `--node-default`, `--bun-default`, `--deno-default`, `--node-date`), error and exit with a clear message:

```
Error: --schema cannot be combined with resolve flags (--node, --bun, --deno, etc.)
```

Validation happens at the top of `resolveHandler`, before any other work.

## Testing

- `freshness: "cache"` returns `source: "cache"` without making network calls
- `freshness: "api"` returns `source: "api"` on success
- `freshness: "api"` fails with `FreshnessError` when network is unavailable
- `freshness: "auto"` (default) works as before (backward compatible)
- CLI `--schema` with any resolve flag produces error message and exits
- CLI `--freshness` validates against `["auto", "api", "cache"]`
