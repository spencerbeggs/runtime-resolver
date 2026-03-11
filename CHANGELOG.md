# runtime-resolver

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
