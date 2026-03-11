# Offline Fallback and Caching

## Overview

runtime-resolver bundles build-time version data that serves as a fallback when GitHub and nodejs.org are unreachable. This ensures the package works in air-gapped environments, CI sandboxes, and during GitHub outages without any additional configuration.

## How It Works

1. At build time, `pnpm run generate:defaults` fetches current version data from
   GitHub and nodejs.org.
2. The data is written to TypeScript files in `src/data/`:
   - `node-defaults.ts` -- Node.js dist index and release schedule
   - `bun-defaults.ts` -- Bun GitHub releases
   - `deno-defaults.ts` -- Deno GitHub releases
3. These files are bundled into the published package.
4. At runtime, cache layers load this data as a fallback when live fetches fail.

## Cache Layer Variants

Freshness is controlled by choosing a cache layer variant. Each runtime has three options:

| Layer | Behavior |
| --- | --- |
| `AutoNodeCacheLive` | Try API first, fall back to bundled defaults on network/parse errors |
| `FreshNodeCacheLive` | Require API data; fail with `FreshnessError` if unavailable |
| `OfflineNodeCacheLive` | Use bundled defaults only; never contact the network |

Bun and Deno have equivalent layers (`AutoBunCacheLive`, `FreshBunCacheLive`,
`OfflineBunCacheLive`, etc.).

The pre-built Promise API functions and CLI use the `Auto` variants by default.

### Effect API example

```typescript
import {
  NodeResolver, NodeResolverLive, OfflineNodeCacheLive,
} from "runtime-resolver"
import { Effect } from "effect"

// Explicit offline mode -- never hit the network
const NodeLayer = NodeResolverLive.pipe(Layer.provide(OfflineNodeCacheLive))

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=20" })
})

const result = await Effect.runPromise(program.pipe(Effect.provide(NodeLayer)))
```

For authenticated requests that increase your rate limit, set a GitHub token:

```bash
export GITHUB_TOKEN=ghp_xxxx
```

The token resolution checks `GITHUB_PERSONAL_ACCESS_TOKEN` first, then falls back to `GITHUB_TOKEN`. If neither is set, unauthenticated requests are attempted (subject to lower rate limits).

## Regenerating Defaults

To update the bundled data during development:

```bash
# Requires GITHUB_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN
pnpm run generate:defaults
```

The defaults are also updated automatically via a daily GitHub Actions workflow (`.github/workflows/update-defaults.yml`).

The script only writes files when content has actually changed, so repeated runs do not produce unnecessary diffs.

## JSON Schema Generation

The CLI response schema is also generated at build time:

```bash
pnpm run generate:json-schema
```

This produces `runtime-resolver.schema.json` at the repository root. CLI responses reference it via the `$schema` property so that editors and CI tools can validate output.
