---
"runtime-resolver": minor
---

feat: initial release of runtime-resolver

Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes from
GitHub release and tag data. Supports both a Promise-based API for quick
integration and a full Effect service/layer architecture for advanced
composition.

- Promise API: `resolveNode()`, `resolveBun()`, `resolveDeno()` with automatic
  GitHub authentication via environment variables
- Effect services: `NodeResolver`, `BunResolver`, `DenoResolver` with
  composable layers for authentication, caching, and GitHub client
- CLI: `runtime-resolver` command with `--node`, `--bun`, `--deno` flags and
  JSON output
- GitHub App and personal access token authentication strategies
- Build-time version cache with automatic offline fallback
- Node.js release schedule awareness (current, active-lts, maintenance-lts)
- Configurable version increments (latest, minor, patch) and freshness
  (auto, api, cache)
