# Promise API

The Promise API is the simplest way to use runtime-resolver. It exposes three
functions -- `resolveNode`, `resolveBun`, and `resolveDeno` -- that each return
a `Promise<ResolvedVersions>`. No knowledge of Effect is required.

## Installation

```bash
npm install runtime-resolver
```

## Quick Start

```typescript
import { resolveNode, resolveBun, resolveDeno } from "runtime-resolver";

const node = await resolveNode();
console.log(node.versions); // ["24.1.0", "22.15.0"]
console.log(node.latest);   // "24.1.0"
console.log(node.lts);      // "22.15.0"
console.log(node.default);  // "22.15.0" (latest LTS when no defaultVersion is set)
console.log(node.source);   // "api" or "cache"

const bun = await resolveBun();
console.log(bun.latest);  // "1.2.14"
console.log(bun.source);  // "api"

const deno = await resolveDeno();
console.log(deno.latest); // "2.3.2"
console.log(deno.source); // "api"
```

## Functions

### resolveNode(options?)

Resolves Node.js versions from the official release index, filtered by release
phase and semver range.

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `semverRange` | `string` | `">=0.0.0"` | Semver range to filter versions |
| `defaultVersion` | `string` | -- | Version to include if it matches |
| `phases` | `NodePhase[]` | `["current", "active-lts"]` | Filter by release phase |
| `increments` | `Increments` | `"latest"` | Version granularity |
| `freshness` | `Freshness` | `"auto"` | Data freshness strategy |
| `date` | `Date` | `new Date()` | Reference date for phase calculation |

#### semverRange

Filter results to versions matching a semver range. Invalid semver ranges cause
an `InvalidInputError` to be thrown.

```typescript
// Only Node.js 20.x versions
const result = await resolveNode({ semverRange: "^20.0.0" });
console.log(result.versions); // ["20.19.2"]
```

```typescript
// Node.js 18 or newer
const result = await resolveNode({ semverRange: ">=18.0.0" });
console.log(result.versions); // ["24.1.0", "22.15.0", "20.19.2", "18.20.8"]
```

#### defaultVersion

Include a specific version in the results, even if it would not normally appear
based on the `phases` or `increments` filters. The version must exist in the
Node.js release index.

When no `defaultVersion` is provided, the `default` field is automatically set
to the latest LTS version in the result set.

```typescript
const result = await resolveNode({
  defaultVersion: "18.20.8",
  phases: ["current"],
});
// 18.20.8 is maintenance LTS, but it appears because it was requested
console.log(result.versions); // ["24.1.0", "18.20.8"]
```

#### phases

Control which Node.js release phases to include. Available phases:

- `"current"` -- The latest major version in active development
- `"active-lts"` -- Versions under active Long Term Support
- `"maintenance-lts"` -- Versions receiving critical fixes only
- `"end-of-life"` -- Versions no longer supported

```typescript
// Only LTS versions (active and maintenance)
const result = await resolveNode({
  phases: ["active-lts", "maintenance-lts"],
});
console.log(result.versions); // ["22.15.0", "20.19.2"]
```

```typescript
// Everything including end-of-life
const result = await resolveNode({
  phases: ["current", "active-lts", "maintenance-lts", "end-of-life"],
  semverRange: ">=16.0.0",
});
```

#### increments

Control the granularity of returned versions:

- `"latest"` -- One version per major (the highest). This is the default.
- `"minor"` -- One version per major.minor (the highest patch).
- `"patch"` -- Every individual version.

```typescript
// One version per major (default behavior)
const result = await resolveNode({ increments: "latest" });
console.log(result.versions); // ["24.1.0", "22.15.0"]

// One version per minor
const minor = await resolveNode({
  increments: "minor",
  semverRange: "^22.0.0",
});
console.log(minor.versions); // ["22.15.0", "22.14.0", "22.13.1", ...]

// Every patch release
const all = await resolveNode({
  increments: "patch",
  semverRange: "~22.15.0",
});
console.log(all.versions); // ["22.15.2", "22.15.1", "22.15.0"]
```

#### freshness

Control how the resolver fetches version data. The `Freshness` type is
`"auto" | "api" | "cache"`:

- `"auto"` (default) -- Try the API first, fall back to the bundled cache on
  network failure.
- `"api"` -- Require fresh data from the API. Fails with an error if the
  network is unavailable.
- `"cache"` -- Use the bundled cache only, skipping all network requests.

```typescript
// Require live data -- fail if the network is down
const result = await resolveNode({ freshness: "api" });

// Offline mode -- never hit the network
const cached = await resolveNode({ freshness: "cache" });
```

#### date

Override the reference date used for phase calculation. Useful for reproducible
builds or testing what versions were active at a past date.

```typescript
// What was current/active-lts on Jan 1, 2024?
const result = await resolveNode({
  date: new Date("2024-01-01"),
});
```

### resolveBun(options?)

Resolves Bun versions from GitHub tags.

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `semverRange` | `string` | `"*"` (all versions) | Semver range to filter versions |
| `defaultVersion` | `string` | -- | Version to include if it matches |
| `increments` | `Increments` | `"latest"` | Version granularity |
| `freshness` | `Freshness` | `"auto"` | Data freshness strategy |

```typescript
import { resolveBun } from "runtime-resolver";

// All Bun versions
const all = await resolveBun();
console.log(all.latest); // "1.2.14"
console.log(all.source); // "api"

// Only Bun 1.1.x
const result = await resolveBun({ semverRange: "~1.1.0" });
console.log(result.versions); // ["1.1.43", "1.1.42", ...]

// Control granularity
const minor = await resolveBun({ increments: "minor" });
console.log(minor.versions); // one version per minor release

// Ensure a specific version is included
const pinned = await resolveBun({
  semverRange: "^1.2.0",
  defaultVersion: "1.1.0",
});
```

### resolveDeno(options?)

Resolves Deno versions from GitHub tags.

#### Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `semverRange` | `string` | `"*"` (all versions) | Semver range to filter versions |
| `defaultVersion` | `string` | -- | Version to include if it matches |
| `increments` | `Increments` | `"latest"` | Version granularity |
| `freshness` | `Freshness` | `"auto"` | Data freshness strategy |

```typescript
import { resolveDeno } from "runtime-resolver";

// All Deno versions
const all = await resolveDeno();
console.log(all.latest); // "2.3.2"
console.log(all.source); // "api"

// Only Deno 2.x
const result = await resolveDeno({ semverRange: "^2.0.0" });
console.log(result.versions); // ["2.3.2", "2.2.12", ...]

// Control granularity
const minor = await resolveDeno({ increments: "minor" });
console.log(minor.versions); // one version per minor release
```

## Return Type

All three functions return `Promise<ResolvedVersions>`:

```typescript
interface ResolvedVersions {
  source: "api" | "cache"; // Where the data came from
  versions: string[];      // Semver sorted descending (newest first)
  latest: string;          // Most recent version across all releases
  lts?: string;            // Most recent LTS version (Node.js only)
  default?: string;        // Resolved value of defaultVersion option
}
```

- **`source`** -- Indicates whether the data was fetched live from the API
  (`"api"`) or loaded from the bundled build-time cache (`"cache"`). Useful for
  detecting offline fallback scenarios.
- **`versions`** -- All matching versions, sorted newest to oldest.
- **`latest`** -- The single newest version. For Node.js this is the newest
  version matching your filters. For Bun and Deno this is always the newest
  release regardless of your `semverRange`.
- **`lts`** -- Present only for Node.js. The newest version in the result set
  that has LTS status.
- **`default`** -- Present only when you pass a `defaultVersion` option and it
  resolves to an actual release. For Node.js, when no `defaultVersion` is
  provided, this defaults to the latest LTS version.

## Authentication

The resolvers fetch version data from GitHub and the Node.js release index. For
GitHub API calls, authentication increases your rate limit from 60 to 5,000
requests per hour.

Set one of these environment variables:

```bash
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."
# or
export GITHUB_TOKEN="ghp_..."
```

`GITHUB_PERSONAL_ACCESS_TOKEN` is checked first, then `GITHUB_TOKEN`. If
neither is set, requests are made without authentication. When the network is
unavailable, all resolvers fall back to bundled offline data that ships with
the package.

## Error Handling

The Promise API functions throw on failure. Wrap calls in try/catch to handle
errors gracefully:

```typescript
import { resolveNode } from "runtime-resolver";

try {
  const result = await resolveNode({ semverRange: "^99.0.0" });
  console.log(result.versions);
} catch (error) {
  console.error("Failed to resolve versions:", error.message);
}
```

Common failure scenarios:

- **Invalid input** -- The semver range is not a valid semver expression.
- **No matching versions** -- The semver range or phase filters exclude
  everything.
- **Network failure without cache** -- GitHub API is unreachable and no cached
  data is available.
- **Rate limiting** -- GitHub API rate limit exceeded (the library retries
  automatically with exponential backoff, but may still fail after retries).

## Types

All option and result types are exported for TypeScript users:

```typescript
import type {
  NodeResolverOptions,
  BunResolverOptions,
  DenoResolverOptions,
  ResolvedVersions,
  NodePhase,
  Increments,
  Freshness,
  Source,
} from "runtime-resolver";
```
