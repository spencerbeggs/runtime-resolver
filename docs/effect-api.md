# Effect API

Import from `runtime-resolver/effect` to access all services, layers, error
types, and schemas. This entry point gives you full control over composition,
error handling, and dependency injection using Effect's standard patterns.

```typescript
import {
  NodeResolver, NodeResolverLive,
  GitHubClientLive, GitHubTokenAuth,
  VersionCacheLive,
} from "runtime-resolver/effect"
```

## Services

Each service is a `Context.Tag` (class-based pattern). Yield a tag inside
`Effect.gen` to access its methods.

### NodeResolver

```typescript
interface NodeResolverShape {
  resolve(options?: NodeResolverOptions): Effect<ResolvedVersions, NodeResolverError>
  resolveVersion(versionOrRange: string): Effect<string, NodeResolverError>
}
```

`NodeResolverOptions` accepts:

| Field | Type | Default |
| --- | --- | --- |
| `semverRange` | `string` | `">=0.0.0"` |
| `defaultVersion` | `string` | -- |
| `phases` | `NodePhase[]` | `["current", "active-lts"]` |
| `increments` | `Increments` | `"latest"` |
| `date` | `Date` | `new Date()` |

`NodePhase` is `"current" | "active-lts" | "maintenance-lts" | "end-of-life"`.
`Increments` is `"latest" | "minor" | "patch"`.

### BunResolver

```typescript
interface BunResolverShape {
  resolve(options?: BunResolverOptions): Effect<ResolvedVersions, BunResolverError>
}
```

`BunResolverOptions` accepts `semverRange` and `defaultVersion`.

### DenoResolver

```typescript
interface DenoResolverShape {
  resolve(options?: DenoResolverOptions): Effect<ResolvedVersions, DenoResolverError>
}
```

`DenoResolverOptions` accepts `semverRange` and `defaultVersion`.

### GitHubClient

```typescript
interface GitHubClientShape {
  listTags(
    owner: string, repo: string, options?: ListOptions,
  ): Effect<ReadonlyArray<GitHubTag>, NetworkError | RateLimitError | ParseError>

  listReleases(
    owner: string, repo: string, options?: ListOptions,
  ): Effect<ReadonlyArray<GitHubRelease>, NetworkError | RateLimitError | ParseError>

  getJson<A>(
    url: string,
    schema: { decode: (input: unknown) => Effect<A, ParseError> },
  ): Effect<A, NetworkError | ParseError>
}
```

`ListOptions` accepts `perPage` (default `100`) and `pages` (default `1`).

### VersionCache

```typescript
interface VersionCacheShape {
  get(runtime: Runtime): Effect<CachedData, CacheError>
  set(runtime: Runtime, data: CachedData): Effect<void, CacheError>
}
```

`Runtime` is `"node" | "bun" | "deno"`.

### OctokitInstance

Low-level tag providing an Octokit-compatible client. You rarely interact with
this directly -- authentication layers produce it.

## Layers

### Dependency graph

```text
NodeResolverLive ──┐
BunResolverLive  ──┼── GitHubClientLive ── OctokitInstance
DenoResolverLive ──┤
                   └── VersionCacheLive
```

Each resolver layer requires `GitHubClient | VersionCache`.
`GitHubClientLive` requires `OctokitInstance`.
`VersionCacheLive` is self-contained (in-memory cache with bundled fallback
data).

### Authentication layers

All authentication layers produce `OctokitInstance`.

**`GitHubTokenAuth`** -- reads environment variables in order:
`GITHUB_PERSONAL_ACCESS_TOKEN`, then `GITHUB_TOKEN`. Falls back to
unauthenticated requests when neither is set.

**`GitHubTokenAuthFromToken(token: string)`** -- uses an explicit token string.

**`GitHubAppAuth(config: GitHubAppAuthConfig)`** -- authenticates as a GitHub
App installation. Requires the `@octokit/auth-app` peer dependency.

```typescript
interface GitHubAppAuthConfig {
  readonly appId: string
  readonly privateKey: string
  readonly installationId?: number  // auto-discovered when omitted
}
```

### Composing a full layer stack

```typescript
import {
  NodeResolver,
  NodeResolverLive,
  GitHubClientLive,
  GitHubTokenAuth,
  VersionCacheLive,
} from "runtime-resolver/effect"
import { Effect, Layer } from "effect"

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth))
const SharedLayer = Layer.merge(GitHubLayer, VersionCacheLive)
const NodeLayer = NodeResolverLive.pipe(Layer.provide(SharedLayer))

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=20" })
})

const result = await Effect.runPromise(program.pipe(Effect.provide(NodeLayer)))
console.log(result.latest)   // e.g. "22.14.0"
console.log(result.versions) // all matching versions, descending
```

## ResolvedVersions

Every resolver returns the same shape:

```typescript
interface ResolvedVersions {
  versions: string[]   // all matching versions, semver-descending
  latest: string       // highest version
  lts?: string         // latest LTS (Node.js only)
  default?: string     // pinned default when defaultVersion is set
}
```

## Error types

All errors extend `Data.TaggedError`. Discriminate with `Effect.catchTag`.

| Error | `_tag` | Key fields |
| --- | --- | --- |
| `NetworkError` | `"NetworkError"` | `url`, `status?`, `message` |
| `RateLimitError` | `"RateLimitError"` | `retryAfter?`, `limit`, `remaining`, `message` |
| `ParseError` | `"ParseError"` | `source`, `message` |
| `VersionNotFoundError` | `"VersionNotFoundError"` | `runtime`, `constraint`, `message` |
| `InvalidInputError` | `"InvalidInputError"` | `field`, `value`, `message` |
| `CacheError` | `"CacheError"` | `operation` (`"read"` or `"write"`), `message` |

### Handling errors with catchTag

```typescript
import { Effect } from "effect"
import {
  NodeResolver,
  VersionNotFoundError,
  RateLimitError,
} from "runtime-resolver/effect"

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=99" })
}).pipe(
  Effect.catchTag("VersionNotFoundError", (err) =>
    Effect.succeed({ versions: [], latest: "none", constraint: err.constraint }),
  ),
  Effect.catchTag("RateLimitError", (err) =>
    Effect.fail(new Error(`Rate limited. Retry after ${err.retryAfter}s`)),
  ),
)
```

## Custom layer example

Swap `GitHubTokenAuth` for `GitHubAppAuth` to authenticate as a GitHub App
installation. This is useful in CI environments or server-side applications.

```typescript
import {
  BunResolver,
  BunResolverLive,
  DenoResolver,
  DenoResolverLive,
  GitHubAppAuth,
  GitHubClientLive,
  VersionCacheLive,
} from "runtime-resolver/effect"
import { Effect, Layer } from "effect"

const AppAuthLayer = GitHubAppAuth({
  appId: process.env.GH_APP_ID!,
  privateKey: process.env.GH_APP_PRIVATE_KEY!,
  // installationId is auto-discovered when omitted
})

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(AppAuthLayer))
const SharedLayer = Layer.merge(GitHubLayer, VersionCacheLive)

const BunLayer = BunResolverLive.pipe(Layer.provide(SharedLayer))
const DenoLayer = DenoResolverLive.pipe(Layer.provide(SharedLayer))
const FullLayer = Layer.merge(BunLayer, DenoLayer)

const program = Effect.gen(function* () {
  const bun = yield* BunResolver
  const deno = yield* DenoResolver

  const [bunVersions, denoVersions] = yield* Effect.all([
    bun.resolve({ semverRange: ">=1.1" }),
    deno.resolve({ semverRange: ">=2" }),
  ])

  return { bun: bunVersions.latest, deno: denoVersions.latest }
})

const result = await Effect.runPromise(program.pipe(Effect.provide(FullLayer)))
```

Because `GitHubAppAuth` can itself fail with `NetworkError` (during
installation token exchange), the layer type is
`Layer<OctokitInstance, NetworkError>`. Effect surfaces this as a defect if the
layer fails to build. Handle it at the edge with `Effect.catchAllDefect` if you
need graceful recovery.
