---
"runtime-resolver": minor
---

Rewrite domain model with Effect architecture using semver-effect

- Add typed domain classes: NodeRelease, BunRelease, DenoRelease, NodeSchedule
- Add runtime-specific cache services: NodeReleaseCache, BunReleaseCache, DenoReleaseCache
- Add fetcher services: NodeVersionFetcher, NodeScheduleFetcher, BunVersionFetcher, DenoVersionFetcher
- Add freshness as a Layer concern with Auto/Fresh/Offline cache variants per runtime
- Remove freshness option from resolver APIs and CLI
- Remove resolveVersion method from all resolvers
- Remove VersionCache/VersionCacheLive in favor of runtime-specific caches backed by semver-effect
- Simplify resolver error unions to VersionNotFoundError
- Add daily GitHub Actions workflow for updating bundled defaults
