---
"runtime-resolver": minor
---

## Features

Migrate to modern Effect patterns and semver-effect 0.2.0 API.

- Upgrade semver-effect to 0.2.0 (`SemVer.parse`, `Range.parse`, flat `SemVer` type)
- Migrate all 12 services from deprecated `Context.GenericTag` to class-based `Context.Tag`
- Remove `*Base` workaround exports for api-extractor (now suppressed by builder)
- Inline `Data.TaggedError` and `Data.TaggedClass` directly in error/schema classes

Resolves #5.
