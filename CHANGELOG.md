# runtime-resolver

## 0.3.4

### Other

* [`d986d5a`](https://github.com/spencerbeggs/runtime-resolver/commit/d986d5a431ff87b1ca095edb74a7912aa0f044a3) Updated bundled runtime version defaults

## 0.3.3

### Other

* [`968e580`](https://github.com/spencerbeggs/runtime-resolver/commit/968e580685a0fc67ead8bb29d55f5fb599b51d0b) Moved Effect packages from dependencies to peer dependencies for better deduplication in library consumers

## 0.3.2

### Other

* [`15e527b`](https://github.com/spencerbeggs/runtime-resolver/commit/15e527be600156b9de9d175d2d7eb8bde46eeb40) Updated bundled runtime version defaults

## 0.3.1

### Other

* [`01eda34`](https://github.com/spencerbeggs/runtime-resolver/commit/01eda344598d85ff8533da21ebbc0b41bcb19282) Aligns with new test harness

## 0.3.0

### Features

* [`9098215`](https://github.com/spencerbeggs/runtime-resolver/commit/90982157860fbd26a4fdb53bf9c16732e278f513) Migrate to modern Effect patterns and semver-effect 0.2.0 API.

- Upgrade semver-effect to 0.2.0 (`SemVer.parse`, `Range.parse`, flat `SemVer` type)
- Migrate all 12 services from deprecated `Context.GenericTag` to class-based `Context.Tag`
- Remove `*Base` workaround exports for api-extractor (now suppressed by builder)
- Inline `Data.TaggedError` and `Data.TaggedClass` directly in error/schema classes

Resolves #5.

## 0.2.0

### Minor Changes

* [`e584b86`](https://github.com/spencerbeggs/runtime-resolver/commit/e584b869c6c03928aaec4b302984b5d5f6a7fc61) Rewrite domain model with Effect architecture using semver-effect

* Add typed domain classes: NodeRelease, BunRelease, DenoRelease, NodeSchedule

* Add runtime-specific cache services: NodeReleaseCache, BunReleaseCache, DenoReleaseCache

* Add fetcher services: NodeVersionFetcher, NodeScheduleFetcher, BunVersionFetcher, DenoVersionFetcher

* Add freshness as a Layer concern with Auto/Fresh/Offline cache variants per runtime

* Remove freshness option from resolver APIs and CLI

* Remove resolveVersion method from all resolvers

* Remove VersionCache/VersionCacheLive in favor of runtime-specific caches backed by semver-effect

* Simplify resolver error unions to VersionNotFoundError

* Add daily GitHub Actions workflow for updating bundled defaults

## 0.1.0

### Minor Changes

* [`6ee3439`](https://github.com/spencerbeggs/runtime-resolver/commit/6ee3439a91898ceb870550aeece75d2474c3434b) feat: initial release of runtime-resolver

Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes from
GitHub release and tag data. Supports both a Promise-based API for quick
integration and a full Effect service/layer architecture for advanced
composition.

* Promise API: `resolveNode()`, `resolveBun()`, `resolveDeno()` with automatic
  GitHub authentication via environment variables
* Effect services: `NodeResolver`, `BunResolver`, `DenoResolver` with
  composable layers for authentication, caching, and GitHub client
* CLI: `runtime-resolver` command with `--node`, `--bun`, `--deno` flags and
  JSON output
* GitHub App and personal access token authentication strategies
* Build-time version cache with automatic offline fallback
* Node.js release schedule awareness (current, active-lts, maintenance-lts)
* Configurable version increments (latest, minor, patch) and freshness
  (auto, api, cache)
