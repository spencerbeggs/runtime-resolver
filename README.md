# runtime-resolver

[![npm version](https://img.shields.io/npm/v/runtime-resolver)](https://www.npmjs.com/package/runtime-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes. Fetches available versions from GitHub with automatic offline fallback via a build-time cache.

## Features

- Resolve matching versions for Node.js, Bun, and Deno with a single call
- Filter Node.js results by release phase (current, active-lts, maintenance-lts)
- Control version granularity with increment levels (latest, minor, patch) for all runtimes
- Resolve a single version from a semver range with `resolveVersion`
- Control data freshness with `freshness` option (`"auto"`, `"api"`, or `"cache"`)
- Track data provenance with the `source` field (`"api"` or `"cache"`)
- Input validation with typed `InvalidInputError` for all resolvers
- Offline fallback using bundled version data when GitHub is unreachable
- CLI with structured JSON output for CI/CD pipelines

## Installation

```bash
npm install runtime-resolver
```

## Quick Start

```typescript
import { resolveNode, resolveBun, resolveDeno } from "runtime-resolver";

const node = await resolveNode({ semverRange: ">=20" });
console.log(node.latest);  // e.g. "22.14.0"
console.log(node.source);  // "api" or "cache"
console.log(node.default); // latest LTS version

const bun = await resolveBun({ semverRange: ">=1.1", increments: "minor" });
const deno = await resolveDeno({ semverRange: ">=2", increments: "minor" });
```

Set a `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
for authenticated requests. Without one, the resolver falls back to cached data.

### CLI

```bash
npx runtime-resolver --node ">=22" --bun "^1" --deno ">=2" --pretty
```

Output is structured JSON with a `$schema` reference for editor auto-complete. Print the full schema with `--schema`:

```bash
npx runtime-resolver --schema
```

#### Useful `jq` recipes

```bash
# Get the latest resolved Node.js version
npx runtime-resolver --node ">=22" | jq -r '.results.node.latest'

# List all matching versions as plain lines
npx runtime-resolver --deno ">=2" | jq -r '.results.deno.versions[]'

# Exit non-zero when any runtime fails to resolve
npx runtime-resolver --node ">=22" --bun "^1" | jq -e '.ok'

# Extract only the LTS version for Node.js
npx runtime-resolver --node ">=20" --node-phases active-lts | jq -r '.results.node.lts'

# Build a comma-separated matrix for GitHub Actions
npx runtime-resolver --node ">=20" --increments minor \
  | jq -r '[.results.node.versions[]] | join(",")'
```

### Effect API

Power users can compose resolvers with custom layers and typed error handling instead of the Promise wrappers.

```typescript
import { Effect, Layer } from "effect";
import {
  NodeResolver,
  NodeResolverLive,
  GitHubClientLive,
  GitHubTokenAuth,
  VersionCacheLive,
} from "runtime-resolver";

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver;
  return yield* resolver.resolve({
    semverRange: ">=22",
    phases: ["active-lts"],
  });
});

const layer = NodeResolverLive.pipe(
  Layer.provide(Layer.merge(
    GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth)),
    VersionCacheLive,
  )),
);

Effect.runPromise(program.pipe(Effect.provide(layer)));
```

All services (`NodeResolver`, `BunResolver`, `DenoResolver`, `GitHubClient`,
`VersionCache`), live layers, auth layers (`GitHubTokenAuth`, `GitHubAppAuth`,
`GitHubAutoAuth`), and typed errors (`AuthenticationError`, `NetworkError`,
`RateLimitError`, `VersionNotFoundError`, etc.) are exported from the package
root.

## Documentation

For configuration, API reference, and advanced usage, see [docs](./docs/).

## License

[MIT](./LICENSE)
