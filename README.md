# runtime-resolver

[![npm version](https://img.shields.io/npm/v/runtime-resolver)](https://www.npmjs.com/package/runtime-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes. Fetches
available versions from GitHub with automatic offline fallback via a build-time
cache.

## Features

- Resolve matching versions for Node.js, Bun, and Deno with a single call
- Filter Node.js results by release phase (current, active-lts, maintenance-lts)
- Control version granularity with increment levels (latest, minor, patch)
- Offline fallback using bundled version data when GitHub is unreachable
- CLI with structured JSON output for CI/CD pipelines

## Installation

```bash
npm install runtime-resolver
```

## Quick Start

```typescript
import { resolveNode, resolveBun, resolveDeno } from "runtime-resolver";

const node = await resolveNode({ semverRange: ">=20" });
console.log(node.latest); // e.g. "22.14.0"
console.log(node.versions); // ["22.14.0", "22.13.1", ...]

const bun = await resolveBun({ semverRange: ">=1.1" });
const deno = await resolveDeno({ semverRange: ">=2" });
```

Set a `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
for authenticated requests. Without one, the resolver falls back to cached data.

### CLI

```bash
runtime-resolver --node ">=20" --bun ">=1.1" --deno ">=2" --pretty
```

## Documentation

For configuration, API reference, and advanced usage, see [docs/](./docs/).

## License

[MIT](./LICENSE)
