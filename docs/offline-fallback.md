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

## Cache Behavior

The in-memory cache has three tiers:

1. **Network fetch** -- always tried first by the resolver layers; results are
   stored in memory via `VersionCache.set`.
2. **Memory cache** -- subsequent calls in the same process reuse previously
   fetched data without another network round-trip.
3. **Bundled defaults** -- used when the network is unavailable and no memory
   cache exists for the requested runtime.

The fallback is transparent. Callers receive the same data structures regardless
of whether the values came from a live fetch or the bundled defaults.

## Freshness

Bundled data is as fresh as the latest published package version. For
applications that need guaranteed freshness, set a GitHub token so that network
fetches succeed:

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
