# Authentication

## Overview

runtime-resolver uses GitHub APIs to fetch version data for Node.js, Bun, and
Deno runtimes. Authentication increases rate limits from 60 to 5,000 requests
per hour. Without auth, the package falls back to bundled offline data when
rate-limited.

## Token Authentication (Default)

The simplest option. Set an environment variable:

```bash
# Preferred - fine-grained PAT
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx

# Fallback - default GitHub token (e.g., in GitHub Actions)
export GITHUB_TOKEN=ghp_xxxx
```

Priority order: `GITHUB_PERSONAL_ACCESS_TOKEN` is checked first, then
`GITHUB_TOKEN`. If neither is set, requests are made without authentication.

No special scopes are required. runtime-resolver only accesses public repository
data.

### Effect API: Explicit Token

If you are composing layers with the Effect API, you can provide a token
directly instead of relying on environment variables:

```typescript
import { GitHubTokenAuthFromToken } from "runtime-resolver/effect";

const layer = GitHubTokenAuthFromToken("ghp_xxxx");
```

This creates an `OctokitInstance` layer authenticated with the given token.

## GitHub App Authentication

For server environments or GitHub Actions with fine-grained permissions, use
GitHub App authentication. This requires the optional `@octokit/auth-app` peer
dependency:

```bash
npm install @octokit/auth-app
```

Then create the layer with your app credentials:

```typescript
import { GitHubAppAuth } from "runtime-resolver/effect";

const layer = GitHubAppAuth({
  appId: "12345",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----...",
  installationId: 67890, // Optional - auto-resolved if omitted
});
```

When `installationId` is omitted, the layer fetches the first available
installation automatically. If no installations are found, the layer fails with
a `NetworkError`.

## Offline Fallback

When authentication fails or the network is unavailable, runtime-resolver uses
bundled version data generated at build time. This data is refreshed each time
the package is published.

The fallback is transparent -- the same `ResolvedVersions` interface is returned
regardless of data source. The data may be slightly stale but provides a working
baseline for CI environments and air-gapped systems.

## GitHub Actions

The built-in `GITHUB_TOKEN` secret is sufficient for most workflows:

```yaml
- uses: actions/checkout@v4
- run: npx runtime-resolver --node ">=20" --pretty
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

For higher rate limits across multiple jobs, use a fine-grained personal access
token stored as a repository secret and set `GITHUB_PERSONAL_ACCESS_TOKEN`
instead.
