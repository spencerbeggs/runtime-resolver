---
"runtime-resolver": major
---

## Breaking Changes

`runtime-resolver` is now a **CLI-only** package. The library API is removed entirely — there is no longer anything to `import` from this package:

- `resolveNode`, `resolveBun`, and `resolveDeno` Promise-based functions are gone.
- Every Effect service, layer, and error export is gone (`NodeResolver`, `BunResolver`, `DenoResolver`, `*CacheLive`, `*FetcherLive`, `GitHubClient`, `AuthenticationError`, `CacheError`, `FreshnessError`, `InvalidInputError`, `NetworkError`, `ParseError`, `RateLimitError`, `VersionNotFoundError`, and related schemas/types).
- `effect`, `@effect/cli`, `@effect/platform`, and `@effect/platform-node` are no longer peer dependencies — there is nothing left to compose against.

Resolution logic now comes entirely from the `@effected/runtimes` kit, and the CLI is rewritten on core `effect/unstable/cli` (`effect` moves to the v4 beta).

### CLI output and exit codes

The CLI no longer wraps results in a response envelope:

- The `--schema` flag, the `$schema` response field, and the published JSON Schema are removed.
- Output is now the kit-native `ResolvedVersions` JSON — a single result object when one runtime is requested, or an object keyed by runtime name when several are requested — written directly to stdout with no `ok`/`results` wrapper.
- The CLI now exits non-zero on usage errors and resolution failures instead of always exiting `0` with the error encoded in the JSON body.

### Authentication

GitHub App authentication is removed. The `--app-id`, `--app-private-key`, and `--app-installation-id` flags are gone — `--token` (or the `GITHUB_PERSONAL_ACCESS_TOKEN`/`GITHUB_TOKEN` environment variables) is now the only supported authentication method.

### Migration

Replace any library usage (`resolveNode`/`resolveBun`/`resolveDeno` or direct service/layer composition) with the `runtime-resolver` CLI, or depend on `@effected/runtimes` directly for programmatic access. Replace `--app-id`/`--app-private-key`/`--app-installation-id` authentication with a `--token` personal access token. Replace `--schema`-based validation with the shape documented in the CLI reference, since there is no longer a published JSON Schema.

## Features

- `--offline` flag forces snapshot-only resolution: no network requests are made, and results carry `source: "cache"`.
