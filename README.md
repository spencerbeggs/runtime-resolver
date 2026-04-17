# runtime-resolver

[![npm version](https://img.shields.io/npm/v/runtime-resolver)](https://www.npmjs.com/package/runtime-resolver)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Effect](https://img.shields.io/badge/Effect-3.x-6644CC)](https://effect.website/)

Resolve semver-compatible versions of Node.js, Bun and Deno runtimes. Fetches available versions from GitHub with automatic offline fallback via a build-time cache.

## Features

- Resolve matching versions for Node.js, Bun and Deno with a single call
- Filter Node.js results by release phase (current, active-lts, maintenance-lts)
- Control version granularity with increment levels (latest, minor, patch) for all runtimes
- Track data provenance with the `source` field (`"api"` or `"cache"`)
- Offline fallback using bundled version data when GitHub is unreachable
- CLI with structured JSON output for CI/CD pipelines
- Full Effect API for custom layer composition and typed error handling

## Installation

```bash
npm install runtime-resolver
```

The Effect packages (`effect`, `@effect/cli`, `@effect/platform`, `@effect/platform-node`) are declared as peer dependencies. npm 7+ and pnpm auto-install them by default. If you already use Effect in your project, your existing versions will be reused.

## Quick Start

```typescript
import { resolveNode, resolveBun, resolveDeno } from "runtime-resolver";

const node = await resolveNode({ semverRange: ">=20" });
console.log(node.latest);  // e.g. "22.14.0"
console.log(node.source);  // "api" or "cache"
console.log(node.default); // latest LTS version

const bun = await resolveBun({ semverRange: ">=1.1", increments: "minor" });
const deno = await resolveDeno({ semverRange: ">=2", increments: "minor" });
```

Set a `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` environment variable for authenticated requests. Without one, the resolver falls back to cached data.

### CLI

```bash
npx runtime-resolver --node ">=22" --bun "^1" --deno ">=2" --pretty
```

Output is structured JSON with a `$schema` reference for editor auto-complete. Print the full schema with `--schema`:

```bash
npx runtime-resolver --schema
```

## Documentation

For configuration, API reference, and advanced usage, see [docs](./docs/).

## License

[MIT](./LICENSE)
