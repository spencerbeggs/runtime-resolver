# Effect API

All services, layers, error types, and schemas are exported from the
`runtime-resolver` package root. This gives you full control over composition,
error handling, and dependency injection using Effect's standard patterns.

```typescript
import {
  NodeResolver, NodeResolverLive,
  AutoNodeCacheLive, FreshNodeCacheLive, OfflineNodeCacheLive,
  GitHubClientLive, GitHubAutoAuth, GitHubTokenAuth,
} from "runtime-resolver"
```

## Services

Each service is a `Context.GenericTag`. Yield a tag inside `Effect.gen` to
access its methods.

### NodeResolver

```typescript
interface NodeResolver {
  resolve(options?: NodeResolverOptions): Effect<ResolvedVersions, VersionNotFoundError>
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

When no `defaultVersion` is provided, the `default` field in the result is
automatically set to the latest LTS version.

### BunResolver

```typescript
interface BunResolver {
  resolve(options?: BunResolverOptions): Effect<ResolvedVersions, VersionNotFoundError>
}
```

`BunResolverOptions` accepts:

| Field | Type | Default |
| --- | --- | --- |
| `semverRange` | `string` | `"*"` |
| `defaultVersion` | `string` | -- |
| `increments` | `Increments` | `"latest"` |

### DenoResolver

```typescript
interface DenoResolver {
  resolve(options?: DenoResolverOptions): Effect<ResolvedVersions, VersionNotFoundError>
}
```

`DenoResolverOptions` accepts:

| Field | Type | Default |
| --- | --- | --- |
| `semverRange` | `string` | `"*"` |
| `defaultVersion` | `string` | -- |
| `increments` | `Increments` | `"latest"` |

### Cache Services

Each runtime has a typed cache service backed by `semver-effect`:

- **`NodeReleaseCache`** -- Extends `RuntimeCache<NodeRelease>` with
  `updateSchedule`, `loadFromInputs`, `ltsReleases`, and `currentReleases`
  methods for Node.js-specific phase filtering.
- **`BunReleaseCache`** -- `RuntimeCache<BunRelease>` with `load`, `resolve`,
  `releases`, `filter`, `latest`, `latestByMajor`, and `latestByMinor`.
- **`DenoReleaseCache`** -- `RuntimeCache<DenoRelease>` with the same
  interface.

All cache services expose semver-aware operations: `resolve(range)` finds the
best match, `filter(range)` returns all matches, and `latestByMajor()` /
`latestByMinor()` group releases by version segment.

### Fetcher Services

Fetchers retrieve version data from upstream sources:

- **`NodeVersionFetcher`** -- Fetches from `nodejs.org/dist/index.json`
- **`NodeScheduleFetcher`** -- Fetches the Node.js release schedule from GitHub
- **`BunVersionFetcher`** -- Fetches Bun releases from GitHub (`oven-sh/bun`)
- **`DenoVersionFetcher`** -- Fetches Deno releases from GitHub (`denoland/deno`)

### GitHubClient

```typescript
interface GitHubClient {
  listTags(
    owner: string, repo: string, options?: ListOptions,
  ): Effect<ReadonlyArray<GitHubTag>, NetworkError | RateLimitError | ParseError | AuthenticationError>

  listReleases(
    owner: string, repo: string, options?: ListOptions,
  ): Effect<ReadonlyArray<GitHubRelease>, NetworkError | RateLimitError | ParseError | AuthenticationError>

  getJson<A>(
    url: string,
    schema: { decode: (input: unknown) => Effect<A, ParseError> },
  ): Effect<A, NetworkError | ParseError>
}
```

`ListOptions` accepts `perPage` (default `100`) and `pages` (default `1`).

### OctokitInstance

Low-level tag providing an Octokit-compatible client. You rarely interact with
this directly -- authentication layers produce it.

## Layers

### Dependency graph

```text
NodeResolverLive ── NodeReleaseCache ──┐
                                       ├── NodeVersionFetcherLive ── GitHubClientLive ── OctokitInstance
                                       └── NodeScheduleFetcherLive ─┘

BunResolverLive  ── BunReleaseCache  ── BunVersionFetcherLive  ── GitHubClientLive ── OctokitInstance
DenoResolverLive ── DenoReleaseCache ── DenoVersionFetcherLive ── GitHubClientLive ── OctokitInstance
```

Each resolver depends on its runtime-specific cache. Caches depend on fetchers.
Fetchers depend on `GitHubClient`. `GitHubClientLive` requires `OctokitInstance`.

### Cache freshness layers

Freshness is a **Layer concern**, not a resolver option. Each runtime has three
cache layer variants:

| Layer | Behavior |
| --- | --- |
| `AutoNodeCacheLive` | Try API first, fall back to bundled defaults on network/parse errors |
| `FreshNodeCacheLive` | Require API data; fail with `FreshnessError` if unavailable |
| `OfflineNodeCacheLive` | Use bundled defaults only; never contact the network |

Bun and Deno have equivalent layers: `AutoBunCacheLive`, `FreshBunCacheLive`,
`OfflineBunCacheLive`, `AutoDenoCacheLive`, `FreshDenoCacheLive`,
`OfflineDenoCacheLive`.

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

**`GitHubAutoAuth`** -- runs the full detection chain: GitHub App env vars →
token env vars → unauthenticated. This is the default layer used by the
pre-built `NodeLayer`, `BunLayer`, and `DenoLayer`. Emits a warning to stderr
when multiple credential sources are detected.

### Composing a full layer stack

```typescript
import {
  NodeResolver,
  NodeResolverLive,
  AutoNodeCacheLive,
  NodeVersionFetcherLive,
  NodeScheduleFetcherLive,
  GitHubClientLive,
  GitHubTokenAuth,
} from "runtime-resolver"
import { Effect, Layer } from "effect"

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth))
const FetchersLayer = Layer.merge(
  NodeVersionFetcherLive.pipe(Layer.provide(GitHubLayer)),
  NodeScheduleFetcherLive.pipe(Layer.provide(GitHubLayer)),
)
const CacheLayer = AutoNodeCacheLive.pipe(Layer.provide(FetchersLayer))
const NodeLayer = NodeResolverLive.pipe(Layer.provide(CacheLayer))

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=20" })
})

const result = await Effect.runPromise(program.pipe(Effect.provide(NodeLayer)))
console.log(result.latest)   // e.g. "22.14.0"
console.log(result.versions) // all matching versions, descending
```

### Using offline mode

Swap `AutoNodeCacheLive` for `OfflineNodeCacheLive` to skip all network
requests:

```typescript
import {
  NodeResolver, NodeResolverLive, OfflineNodeCacheLive,
} from "runtime-resolver"
import { Effect } from "effect"

const NodeLayer = NodeResolverLive.pipe(Layer.provide(OfflineNodeCacheLive))

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=20" })
})

const result = await Effect.runPromise(program.pipe(Effect.provide(NodeLayer)))
```

## Domain Classes

### NodeRelease

Represents a Node.js release with phase-aware metadata. Wraps a `SemVer`
version and an `Ref<NodeSchedule>` for effectful phase lookups:

- `version` -- the `SemVer` instance
- `date` -- release date
- `lts` -- LTS codename or `false`
- `phase(date?)` -- returns `Effect<NodePhase>` based on the release schedule

### BunRelease / DenoRelease

Lightweight release classes wrapping `SemVer` and a release date.

### NodeSchedule

Tracks the lifecycle schedule for a Node.js major version line (start, LTS,
maintenance, end-of-life dates). Used by `NodeRelease.phase()` to determine
the current phase of a release.

## ResolvedVersions

Every resolver returns the same shape:

```typescript
interface ResolvedVersions {
  source: "api" | "cache"  // where the data came from
  versions: string[]       // all matching versions, semver-descending
  latest: string           // highest version
  lts?: string             // latest LTS (Node.js only)
  default?: string         // pinned default when defaultVersion is set
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
| `FreshnessError` | `"FreshnessError"` | `strategy`, `message` |
| `AuthenticationError` | `"AuthenticationError"` | `method` (`"token"` or `"app"`), `message` |

Resolver error unions are simplified -- each resolver can only fail with
`VersionNotFoundError`. Network, parse, and rate limit errors are handled
internally by the cache layers (Auto catches them and falls back; Fresh
converts them to `FreshnessError`).

### Handling errors with catchTag

```typescript
import { Effect } from "effect"
import { NodeResolver } from "runtime-resolver"

const program = Effect.gen(function* () {
  const resolver = yield* NodeResolver
  return yield* resolver.resolve({ semverRange: ">=99" })
}).pipe(
  Effect.catchTag("VersionNotFoundError", (err) =>
    Effect.succeed({ versions: [], latest: "none", constraint: err.constraint }),
  ),
)
```

## Custom layer example

Swap `GitHubTokenAuth` for `GitHubAppAuth` to authenticate as a GitHub App
installation. This is useful in CI environments or server-side applications.

```typescript
import {
  BunResolver, BunResolverLive, AutoBunCacheLive,
  DenoResolver, DenoResolverLive, AutoDenoCacheLive,
  BunVersionFetcherLive, DenoVersionFetcherLive,
  GitHubAppAuth, GitHubClientLive,
} from "runtime-resolver"
import { Effect, Layer } from "effect"

const AppAuthLayer = GitHubAppAuth({
  appId: process.env.GH_APP_ID!,
  privateKey: process.env.GH_APP_PRIVATE_KEY!,
})

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(AppAuthLayer))

const BunLayer = BunResolverLive.pipe(
  Layer.provide(AutoBunCacheLive.pipe(
    Layer.provide(BunVersionFetcherLive.pipe(Layer.provide(GitHubLayer)))
  ))
)
const DenoLayer = DenoResolverLive.pipe(
  Layer.provide(AutoDenoCacheLive.pipe(
    Layer.provide(DenoVersionFetcherLive.pipe(Layer.provide(GitHubLayer)))
  ))
)
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

Because `GitHubAppAuth` can fail during credential validation or installation
token exchange, the layer type is `Layer<OctokitInstance, AuthenticationError>`.
Effect surfaces this as a defect if the
layer fails to build. Handle it at the edge with `Effect.catchAllDefect` if you
need graceful recovery.
