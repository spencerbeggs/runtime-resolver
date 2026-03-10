# Offline Fallback and Caching

## Overview

runtime-resolver bundles build-time version data that serves as a fallback when
GitHub and nodejs.org are unreachable. This ensures the package works in
air-gapped environments, CI sandboxes, and during GitHub outages without any
additional configuration.

## How It Works

1. At build time, `pnpm run generate:defaults` fetches current version data from
   GitHub and nodejs.org.
2. The data is written to TypeScript files in `src/data/`:
   - `node-defaults.ts` -- Node.js dist index and release schedule
   - `bun-defaults.ts` -- Bun GitHub release tags
   - `deno-defaults.ts` -- Deno GitHub release tags
3. These files are bundled into the published package.
4. At runtime, `VersionCacheLive` provides cached or fallback data to resolvers.
5. When the network is unavailable and no memory cache exists, the layer
   transparently falls back to the bundled defaults.

## Detecting Fallback with the `source` Field

Every `ResolvedVersions` result includes a `source` field that indicates where
the data came from:

- `"api"` -- Data was fetched live from GitHub or nodejs.org.
- `"cache"` -- Data was loaded from the bundled build-time cache.

Use this field to detect when the resolver is operating in offline mode:

```typescript
import { resolveNode } from "runtime-resolver";

const result = await resolveNode({ semverRange: ">=20" });
if (result.source === "cache") {
  console.warn("Using bundled offline data — versions may not be current");
}
```

In the CLI, the `source` field appears in each runtime result:

```bash
runtime-resolver --node ">=20" | jq -r '.results.node.source'
# "api" when fetched live, "cache" when using bundled data
```

## Cache Behavior

The in-memory cache has three tiers:

1. **Network fetch** -- always tried first by the resolver layers; results are
   stored in memory via `VersionCache.set`.
2. **Memory cache** -- subsequent calls in the same process reuse previously
   fetched data without another network round-trip.
3. **Bundled defaults** -- used when the network is unavailable and no memory
   cache exists for the requested runtime.

The fallback is transparent. Callers receive the same data structures regardless
of whether the values came from a live fetch or the bundled defaults. The
`source` field is the only way to distinguish the two.

## Freshness

Bundled data is as fresh as the latest published package version. The
`freshness` option (or `--freshness` CLI flag) gives you explicit control over
how version data is sourced:

- **`freshness: "auto"`** (default) -- Try the API first, fall back to the
  bundled cache on network failure. This is the standard behavior.
- **`freshness: "cache"`** -- Use the bundled cache only, skipping all network
  requests. Useful for explicit offline mode or air-gapped environments where
  you want deterministic results with no external calls.
- **`freshness: "api"`** -- Require fresh data from the API. Fails with a
  `FreshnessError` if the network is unavailable. Useful in CI pipelines where
  you need guaranteed fresh data and would rather fail than use stale versions.

```typescript
// Explicit offline mode -- never hit the network
const result = await resolveNode({ freshness: "cache" });

// CI mode -- fail fast if the API is unreachable
const fresh = await resolveNode({ freshness: "api" });
```

For authenticated requests that increase your rate limit, set a GitHub token:

```bash
export GITHUB_TOKEN=ghp_xxxx
```

The token resolution checks `GITHUB_PERSONAL_ACCESS_TOKEN` first, then falls
back to `GITHUB_TOKEN`. If neither is set, unauthenticated requests are
attempted (subject to lower rate limits).

## Regenerating Defaults

To update the bundled data during development:

```bash
# Requires GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN
pnpm run generate:defaults
```

The script only writes files when content has actually changed, so repeated runs
do not produce unnecessary diffs. Turbo caches the task based on the script
source, schema files, and GitHub client code. The `types:check` task depends on
`generate:defaults`, so a full build always has up-to-date data.

## JSON Schema Generation

The CLI response schema is also generated at build time:

```bash
pnpm run generate:json-schema
```

This produces `runtime-resolver.schema.json` at the repository root. CLI
responses reference it via the `$schema` property so that editors and CI tools
can validate output.
