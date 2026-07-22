# runtime-resolver

[![npm](https://img.shields.io/npm/v/runtime-resolver?label=npm&color=cb3837)](https://www.npmjs.com/package/runtime-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![Effect](https://img.shields.io/badge/Effect-4.x-6644CC)](https://effect.website/)

A command-line tool that resolves semver-compatible versions of Node.js, Bun, and Deno runtimes and prints them as JSON. It fetches live version data with an automatic fallback to a bundled offline snapshot, so it keeps working in CI and air-gapped environments.

## Features

- Resolve matching versions for Node.js, Bun, and Deno in a single call.
- Filter Node.js results by release phase (current, active-lts, maintenance-lts, end-of-life).
- Control version granularity with increment levels (latest, minor, patch) across every runtime.
- Track data provenance with the `source` field (`"api"` for a live fetch, `"cache"` for the offline snapshot).
- Fall back to a bundled offline snapshot when the network or GitHub API is unavailable.
- Emit structured JSON that pairs cleanly with `jq` for CI/CD version matrices.

## Install

```bash
npm install -g runtime-resolver
```

Or run it on demand without installing:

```bash
npx runtime-resolver --node ">=20"
```

The runtime dependencies (`effect`, `@effected/runtimes`, `@effected/semver`) install automatically — there are no peer dependencies to add by hand. Requires Node.js >=24.11.0.

## Quick start

```bash
npx runtime-resolver --node ">=20"
# {"source":"api","versions":["22.14.0","20.19.0"],"latest":"22.14.0","lts":"20.19.0","default":"20.19.0"}
```

Request several runtimes at once and the output becomes an object keyed by runtime name:

```bash
npx runtime-resolver --node ">=20" --bun ">=1" --deno ">=2" --pretty
# {
#   "node": { "source": "api", "versions": ["22.14.0"], "latest": "22.14.0", "lts": "20.19.0", "default": "20.19.0" },
#   "bun":  { "source": "api", "versions": ["1.1.42"], "latest": "1.1.42" },
#   "deno": { "source": "api", "versions": ["2.1.4"], "latest": "2.1.4" }
# }
```

The CLI exits `0` when every requested runtime resolves. A usage error or resolution failure writes a one-line `error: …` to stderr and exits non-zero, so scripts can branch on the exit status.

## Documentation

- [CLI reference](./docs/cli.md) — flags, output format, exit codes, jq recipes, and CI/CD examples.
- [Authentication](./docs/authentication.md) — GitHub token detection order and offline fallback behavior.

See [docs](./docs/) for the full guide index.

## License

[MIT](LICENSE)
