# Effect Domain Model Architecture

## Overview

Replace raw JSON storage and ad-hoc semver processing with Effect-native
domain classes, a generic cache layer backed by semver-effect's VersionCache,
decomposed fetchers, freshness-as-Layers, lean generated defaults, and a CI
auto-release pipeline.

## Goals

- Rich domain objects (`NodeRelease`, `BunRelease`, `DenoRelease`) that carry
  parsed `SemVer` versions and `DateTime` dates
- Schedule-aware Node releases via shared `Ref<NodeSchedule>`
- Generic `RuntimeCache<R>` wrapping semver-effect's `VersionCache` for
  version querying with typed release lookup
- Freshness strategies as Layer composition, not per-call options
- Lean generated defaults (~80% size reduction) with build-time type
  validation
- Daily CI auto-release when runtime data changes

## Breaking Changes

This is a **pre-1.0 package** (version 0.1.0). Breaking changes are expected
and do not require a major version bump per semver conventions. Notable
changes:

- `resolveVersion(versionOrRange)` removed from all resolver interfaces.
  Consumers should use the `RuntimeCache.resolve(range)` method directly
  for single-version resolution, or compose `resolver.resolve({ semverRange })`
  and pick `.latest` from the result.
- `freshness` option removed from resolver options. Freshness is now a Layer
  composition concern. Consumers choose `Auto*CacheLive`, `Fresh*CacheLive`,
  or `Offline*CacheLive` at program composition time.
- `CachedNodeData`, `CachedTagData` types removed (replaced by release
  classes).
- `Freshness` schema literal removed from common.ts.

## Error Types

### Existing (retained)

- `AuthenticationError`, `CacheError`, `FreshnessError`, `InvalidInputError`,
  `NetworkError`, `ParseError`, `RateLimitError`, `VersionNotFoundError`

`FreshnessError` is still used — `Fresh*CacheLive` layers propagate it when
the network is unavailable and the freshness strategy requires live data.

### From semver-effect (re-exported)

- `InvalidVersionError` — returned by `SemVer.fromString` on invalid input.
  Used in release factory methods (`NodeRelease.fromInput`, etc.).
- `UnsatisfiedRangeError` — returned by semver-effect's `VersionCache.resolve`
  when no version satisfies the range. Surfaced through
  `RuntimeCache.resolve()`.
- `EmptyCacheError` — returned by semver-effect's `VersionCache.latest` when
  the cache is empty. Surfaced through `RuntimeCache.latest()`.

---

## Phase 1: Domain Model

### NodeScheduleEntry

```typescript
interface NodeScheduleEntry {
  readonly major: number;
  readonly start: DateTime.DateTime;
  readonly lts: DateTime.DateTime | null;
  readonly maintenance: DateTime.DateTime | null;
  readonly end: DateTime.DateTime;
  readonly codename: string; // "" when absent (odd majors, unnamed even majors)
}
```

### NodeSchedule

`Data.TaggedClass("NodeSchedule")` holding `ReadonlyArray<NodeScheduleEntry>`.

Lives in a `Ref<NodeSchedule>` singleton. The `Ref` is created inside the
`NodeReleaseCacheLive` Layer body (not as a separate Layer dependency) and
passed to `NodeRelease` factories during construction.

Methods:

- `phaseFor(major: number, now: DateTime.DateTime): Effect<NodePhase | null>`
  Determines phase by comparing `now` against the entry's start/lts/
  maintenance/end dates. Returns one of: `"current"`, `"active-lts"`,
  `"maintenance-lts"`, `"end-of-life"`. Phase boundaries:
  - `now < start` → `null` (not yet released)
  - `now >= end` → `"end-of-life"`
  - `now >= maintenance` → `"maintenance-lts"`
  - `now >= lts` → `"active-lts"`
  - otherwise → `"current"`
  - no schedule entry for major → `null`
- `entryFor(major: number): Option<NodeScheduleEntry>`

### NodeScheduleData

The raw schedule format as fetched from the Node.js Release repo. This is
the intermediate type between the fetcher and the `NodeSchedule` class:

```typescript
type NodeScheduleData = Record<string, {
  readonly start: string;
  readonly lts?: string;
  readonly maintenance?: string;
  readonly end: string;
  readonly codename?: string;
}>;
```

The `NodeSchedule` class has a static `fromData(data: NodeScheduleData)`
factory that parses date strings into `DateTime` and normalizes codenames.

### NodeRelease

Plain class (not `Data.TaggedClass`) because it holds a `Ref<NodeSchedule>`
which is a mutable reference and would break `Data.TaggedClass`'s structural
equality semantics. Uses a manual `_tag: "NodeRelease"` field for pattern
matching compatibility.

Fields:

- `_tag: "NodeRelease"` (readonly, for pattern matching)
- `version: SemVer.SemVer`
- `npm: SemVer.SemVer`
- `date: DateTime.DateTime`
- `scheduleRef: Ref<NodeSchedule>`

Computed (effectful, reads from scheduleRef):

- `phase(now?: DateTime.DateTime): Effect<NodePhase | null>`
- `lts(now?: DateTime.DateTime): Effect<boolean>` (phase is active-lts or
  maintenance-lts)

Static factory:

- `NodeRelease.fromInput(input: NodeReleaseInput, scheduleRef: Ref<NodeSchedule>): Effect<NodeRelease, InvalidVersionError>`
  Parses version/npm strings via `SemVer.fromString`, date via DateTime.
  `InvalidVersionError` comes from semver-effect.

### BunRelease

`Data.TaggedClass("BunRelease")`:

- `version: SemVer.SemVer`
- `date: DateTime.DateTime`

Static factory:

- `BunRelease.fromInput(input: RuntimeReleaseInput): Effect<BunRelease, InvalidVersionError>`

### DenoRelease

Same shape as `BunRelease`, tagged `"DenoRelease"`.

### RuntimeRelease (base constraint)

```typescript
interface RuntimeRelease {
  readonly _tag: string;
  readonly version: SemVer.SemVer;
  readonly date: DateTime.DateTime;
}
```

All three release classes satisfy this interface, enabling `RuntimeCache<R>`.

### Input Schemas

```typescript
const NodeReleaseInput = Schema.Struct({
  version: Schema.String,
  npm: Schema.String,
  date: Schema.String,
});

const RuntimeReleaseInput = Schema.Struct({
  version: Schema.String,
  date: Schema.String,
});
```

These are the shapes the defaults generator writes and the factories consume.

---

## Phase 2: Cache Layer

### RuntimeCache\<R extends RuntimeRelease\>

Generic Effect service wrapping semver-effect's `VersionCache`.

Internal state:

- semver-effect `VersionCache` instance (holds `SemVer` objects, handles
  version math)
- `Map<string, R>` keyed by `version.toString()` for release lookup

Interface:

- `load(releases: ReadonlyArray<R>): Effect<void>` - Extracts `SemVer`
  versions, loads into inner cache, populates lookup map
- `resolve(range: string): Effect<R, UnsatisfiedRangeError>` - Delegates
  range resolution to inner cache (returns the single best/latest match),
  maps result to release. Fails with `UnsatisfiedRangeError` if no version
  matches.
- `releases(): Effect<ReadonlyArray<R>>` - All loaded releases
- `filter(range: string): Effect<ReadonlyArray<R>>` - All releases whose
  version satisfies the range. Returns empty array (not error) when no
  versions match. This is the "give me everything matching" counterpart
  to `resolve`'s "give me the best one or fail."
- `latest(): Effect<R, EmptyCacheError>` - Latest by version. Fails with
  `EmptyCacheError` (from semver-effect) if cache is empty.
- `latestByMajor(): Effect<ReadonlyArray<R>>` - Latest per major
- `latestByMinor(): Effect<ReadonlyArray<R>>` - Latest per minor

### NodeReleaseCache

Extends `RuntimeCache<NodeRelease>` with:

- `updateSchedule(data: NodeScheduleData): Effect<void>` - Updates the
  shared `Ref<NodeSchedule>`
- `ltsReleases(now?: DateTime.DateTime): Effect<ReadonlyArray<NodeRelease>>`
  Filters releases where `phase` is active-lts or maintenance-lts
- `currentReleases(now?: DateTime.DateTime): Effect<ReadonlyArray<NodeRelease>>`
  Filters releases where `phase` is current

Layer structure: `NodeReleaseCacheLive` wraps `RuntimeCacheLive` (the
generic implementation) and adds the schedule `Ref`. `RuntimeCacheLive`
itself depends on `SemVerParserLive` and `VersionCacheLive` from
semver-effect. The `Ref<NodeSchedule>` is created inside
`NodeReleaseCacheLive`'s Layer body.

```text
NodeReleaseCacheLive
  ├── RuntimeCacheLive (generic, provides RuntimeCache<NodeRelease>)
  │   ├── SemVerParserLive (from semver-effect)
  │   └── VersionCacheLive (from semver-effect)
  └── Ref<NodeSchedule> (created in Layer body, singleton)
```

### BunReleaseCache / DenoReleaseCache

Plain `RuntimeCache<BunRelease>` / `RuntimeCache<DenoRelease>` instances.
No additional methods needed.

---

## Phase 3: Fetchers

### NodeVersionFetcher

Does NOT implement semver-effect's `VersionFetcher` directly because the
Node dist API returns richer data than just versions. Custom interface:

```typescript
interface NodeVersionFetcher {
  readonly fetch: () => Effect<{
    readonly versions: ReadonlyArray<SemVer.SemVer>;
    readonly inputs: ReadonlyArray<NodeReleaseInput>;
  }, NetworkError | ParseError>;
}
```

Fetches `https://nodejs.org/dist/index.json`, decodes via `NodeDistIndex`
schema. For each entry: strips `v` prefix, parses to `SemVer` (for the
inner semver-effect cache), and extracts lean `NodeReleaseInput` (version,
npm, date strings for `NodeRelease` construction). Both are returned
together so the cache Layer can load both the semver-effect `VersionCache`
and construct `NodeRelease` instances in one pass.

Depends on: `GitHubClient`

### NodeScheduleFetcher

Separate service:

- `fetch(): Effect<NodeScheduleData, NetworkError | ParseError>`

Fetches `schedule.json` from the Node.js Release repo.

Depends on: `GitHubClient`

### BunVersionFetcher

Custom interface (same pattern as Node — returns both versions and inputs):

```typescript
interface BunVersionFetcher {
  readonly fetch: () => Effect<{
    readonly versions: ReadonlyArray<SemVer.SemVer>;
    readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
  }, NetworkError | ParseError>;
}
```

Lists GitHub tags from `oven-sh/bun`, normalizes (remove `bun-` prefix,
strip `v`), parses to `SemVer`. Tags that fail SemVer parsing are silently
skipped (not errors) — `ParseError` covers schema decode failures on the
tag list response itself. Extracts `RuntimeReleaseInput` (version string,
date from tag metadata) for `BunRelease` construction.

Depends on: `GitHubClient`

### DenoVersionFetcher

Same interface and pattern as `BunVersionFetcher` (including `ParseError`),
fetching from `denoland/deno` and stripping `v` prefix only (no `deno-`
prefix).

### Freshness as Layer Variants

Per runtime, three Layer variants. Using Node as example:

- **`AutoNodeCacheLive`** - Tries fetchers, on `NetworkError` falls back to
  defaults loaded from generated inputs. Default behavior.
- **`FreshNodeCacheLive`** - Requires fetchers to succeed. `NetworkError`
  propagates as `FreshnessError`.
- **`OfflineNodeCacheLive`** - Skips fetchers entirely, loads from generated
  default inputs only.

The cache itself is unaware of freshness. The Layer wiring decides whether
and how fetchers are called before `cache.load()`.

Bun and Deno have the same three variants (`Auto*`, `Fresh*`, `Offline*`)
with the same semantics. The differences from Node:

- No `NodeScheduleFetcher` dependency (no schedule)
- Fallback defaults use `RuntimeReleaseInput` (version + date only)
- `BunRelease.fromInput` / `DenoRelease.fromInput` instead of
  `NodeRelease.fromInput`

---

## Phase 4: Defaults Generator

### Generated Output Format

**`node-defaults.ts`:**

```typescript
import type { NodeReleaseInput } from "../schemas/node.js";

export const nodeDefaultInputs: ReadonlyArray<NodeReleaseInput> = [
  { version: "25.8.1", npm: "11.11.0", date: "2026-03-10" },
  // ...
];

export const nodeDefaultSchedule = {
  v25: { start: "2025-04-22", end: "2028-04-30", lts: "2025-10-28",
         maintenance: "2026-10-20", codename: "" },
  // ...
} as const;
```

**`bun-defaults.ts` / `deno-defaults.ts`:**

```typescript
import type { RuntimeReleaseInput } from "../schemas/common.js";

export const bunDefaultInputs: ReadonlyArray<RuntimeReleaseInput> = [
  { version: "1.2.3", date: "2025-01-15" },
  // ...
];
```

### Size Reduction

Node defaults drop `files`, `v8`, `uv`, `zlib`, `openssl`, `modules` fields.
Bun/Deno defaults drop `zipball_url`, `tarball_url`, `commit`, `node_id`.
Expected reduction from ~24K lines to ~3-4K lines for Node.

### Build-Time Validation

Generated files import and type against the input schemas. If the
`NodeRelease` factory expects fields not in `NodeReleaseInput`, the build
fails — catching mismatches at CI time.

---

## Phase 5: Resolver Redesign

### New Interfaces

```typescript
interface NodeResolver {
  resolve(options?: NodeResolverOptions): Effect<ResolvedVersions, NodeResolverError>;
}

interface BunResolver {
  resolve(options?: BunResolverOptions): Effect<ResolvedVersions, BunResolverError>;
}

interface DenoResolver {
  resolve(options?: DenoResolverOptions): Effect<ResolvedVersions, DenoResolverError>;
}
```

`resolveVersion` is removed from the public interface. Consumers use the
cache directly for single-version resolution.

### Options Changes

- `freshness` removed (Layer concern)
- `date` kept on `NodeResolverOptions` for phase computation
- `semverRange`, `increments`, `phases` (Node only) remain

### Resolver Responsibilities

Thin orchestrators:

1. Query `RuntimeCache` for releases matching range
2. Apply domain filters (phases for Node via effectful `release.phase()`)
3. Apply increment grouping (latestByMajor/latestByMinor from cache)
4. Handle default version
5. Return `ResolvedVersions`

### Layer Dependencies

```text
NodeResolverLive
  └── NodeReleaseCache (RuntimeCache<NodeRelease> + schedule methods)

BunResolverLive
  └── BunReleaseCache (RuntimeCache<BunRelease>)

DenoResolverLive
  └── DenoReleaseCache (RuntimeCache<DenoRelease>)
```

---

## Phase 6: CI Auto-Release

### GitHub Action Workflow

Trigger: daily cron schedule.

Steps:

1. Checkout repository
2. Install dependencies
3. Run `pnpm generate:defaults`
4. Check `git diff` on `src/data/` directory
5. If no changes: exit cleanly
6. If changes detected:
   a. Run `pnpm build`
   b. Run `pnpm test`
   c. Create patch-level changeset ("chore: update runtime defaults")
   d. Commit changes + changeset
   e. Push and trigger release workflow

### Generator Script Updates

Same `writeIfChanged` pattern. Output format changes from raw JSON to lean
typed input arrays. The script:

1. Fetches all runtime data (dist index, schedule, GitHub tags)
2. Extracts lean fields (version, npm, date for Node; version, date for
   Bun/Deno)
3. Writes typed TypeScript files importing input schemas
4. Reports which files changed

---

## Files Overview

### New Files

- `src/schemas/node-schedule.ts` - NodeScheduleEntry, NodeSchedule class
- `src/schemas/node-release.ts` - NodeRelease class, NodeReleaseInput schema
- `src/schemas/bun-release.ts` - BunRelease class
- `src/schemas/deno-release.ts` - DenoRelease class
- `src/schemas/runtime-release.ts` - RuntimeRelease interface,
  RuntimeReleaseInput schema
- `src/services/RuntimeCache.ts` - Generic cache service interface
- `src/services/NodeReleaseCache.ts` - Node-specific cache service
- `src/layers/RuntimeCacheLive.ts` - Generic cache implementation
- `src/layers/NodeReleaseCacheLive.ts` - Node cache with schedule
- `src/layers/BunReleaseCacheLive.ts` - Bun cache
- `src/layers/DenoReleaseCacheLive.ts` - Deno cache
- `src/services/NodeVersionFetcher.ts` - Service interface
- `src/services/NodeScheduleFetcher.ts` - Service interface
- `src/services/BunVersionFetcher.ts` - Service interface
- `src/services/DenoVersionFetcher.ts` - Service interface
- `src/layers/NodeVersionFetcherLive.ts` - Implementation
- `src/layers/NodeScheduleFetcherLive.ts` - Implementation
- `src/layers/BunVersionFetcherLive.ts` - Implementation
- `src/layers/DenoVersionFetcherLive.ts` - Implementation
- `src/layers/AutoNodeCacheLive.ts` - Freshness Layer variant
- `src/layers/FreshNodeCacheLive.ts` - Freshness Layer variant
- `src/layers/OfflineNodeCacheLive.ts` - Freshness Layer variant
- (Same three variants for Bun and Deno)
- `.github/workflows/update-defaults.yml` - CI auto-release

### Modified Files

- `src/layers/NodeResolverLive.ts` - Thin orchestrator using cache
- `src/layers/BunResolverLive.ts` - Thin orchestrator using cache
- `src/layers/DenoResolverLive.ts` - Thin orchestrator using cache
- `src/services/NodeResolver.ts` - Remove resolveVersion, remove freshness
- `src/services/BunResolver.ts` - Same
- `src/services/DenoResolver.ts` - Same
- `src/schemas/node.ts` - Keep NodeDistIndex for fetcher decode, remove
  NodeRelease pseudo code, add NodeReleaseInput
- `src/schemas/common.ts` - Add RuntimeReleaseInput, remove Freshness
- `src/index.ts` - Update exports, Layer composition
- `lib/scripts/generate-defaults.mts` - Lean output format
- `src/data/node-defaults.ts` - Lean typed inputs
- `src/data/bun-defaults.ts` - Lean typed inputs
- `src/data/deno-defaults.ts` - Lean typed inputs

### Deleted Files

- `src/lib/node-phases.ts` - Logic moves to NodeSchedule.phaseFor
- `src/lib/semver-utils.ts` - Logic moves to RuntimeCache (delegates to
  semver-effect)
- `src/lib/tag-normalizers.ts` - Logic moves to fetcher implementations
- `src/schemas/cache.ts` - Replaced by typed release classes
- `src/lib/node-phases.test.ts` - Tests move to NodeSchedule tests
- `src/lib/semver-utils.test.ts` - Tests move to RuntimeCache tests
- `src/lib/tag-normalizers.test.ts` - Tests move to fetcher tests
