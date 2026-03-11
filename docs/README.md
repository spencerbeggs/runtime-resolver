# runtime-resolver Documentation

Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes with
offline fallback via a build-time cache.

## Installation

```bash
npm install runtime-resolver
```

## Quick Start

```typescript
import { resolveNode, resolveBun, resolveDeno } from "runtime-resolver";

const node = await resolveNode({ semverRange: ">=20" });
console.log(node.latest);   // e.g. "22.14.0"
console.log(node.versions); // ["22.14.0", "20.19.0", ...]

const bun = await resolveBun({ semverRange: ">=1.1" });
const deno = await resolveDeno({ semverRange: ">=2" });
```

Set `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` for authenticated
requests. Without a token, the resolver falls back to bundled offline data.

## CLI

```bash
npx runtime-resolver --node ">=20" --bun ">=1.1" --deno ">=2" --pretty
```

The CLI outputs structured JSON with a `$schema` property for tooling
integration. It always exits 0 -- errors are encoded in the response envelope.
Running the CLI with no runtime flags shows help text.

## Guides

| Guide | Description |
| ----- | ----------- |
| [Promise API](./promise-api.md) | `resolveNode`, `resolveBun`, `resolveDeno` -- options, return types, and examples |
| [Effect API](./effect-api.md) | Services, layers, and custom composition for Effect consumers |
| [CLI Usage](./cli.md) | Flags, response format, jq recipes, and CI/CD examples |
| [Authentication](./authentication.md) | Token auth, GitHub App auth, and environment variable configuration |
| [Error Handling](./error-handling.md) | All error types with handling patterns for Promise, Effect, and CLI |
| [Offline Fallback](./offline-fallback.md) | Build-time cache, fallback tiers, and data regeneration |

## API Overview

The package provides three interfaces:

### Promise API

Three async functions that return `Promise<ResolvedVersions>`:

- `resolveNode(options?)` -- filter by semver range, release phase, and increment granularity
- `resolveBun(options?)` -- filter by semver range, increment granularity, and default version
- `resolveDeno(options?)` -- filter by semver range, increment granularity, and default version

### Effect API

Import from `runtime-resolver/effect` for full control over dependency
injection, error handling, and layer composition:

- **Services:** `NodeResolver`, `BunResolver`, `DenoResolver`, `GitHubClient`, `NodeReleaseCache`, `BunReleaseCache`, `DenoReleaseCache`
- **Domain classes:** `NodeRelease`, `BunRelease`, `DenoRelease`, `NodeSchedule`
- **Methods:** All resolvers expose `resolve(options?)`
- **Cache layers:** `AutoNodeCacheLive`, `FreshNodeCacheLive`, `OfflineNodeCacheLive` (and equivalents for Bun/Deno)
- **Resolver layers:** `NodeResolverLive`, `BunResolverLive`, `DenoResolverLive`
- **Auth layers:** `GitHubTokenAuth`, `GitHubTokenAuthFromToken`, `GitHubAppAuth`, `GitHubAutoAuth`
- **Errors:** `NetworkError`, `RateLimitError`, `ParseError`, `VersionNotFoundError`, `FreshnessError`, `AuthenticationError`

### CLI

The `runtime-resolver` binary accepts `--node`, `--bun`, and `--deno` flags
with semver ranges. Use `--increments` to control version granularity for all
runtimes, `--node-default`/`--bun-default`/`--deno-default` to pin default
versions, and `--node-date` for reproducible phase calculations. Use `--schema`
to inspect the JSON response format and `--pretty` for human-readable output.

## License

[MIT](../LICENSE)
