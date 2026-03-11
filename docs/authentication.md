# Authentication

## Overview

runtime-resolver uses GitHub APIs to fetch version data for Node.js, Bun, and Deno runtimes. Authentication increases rate limits from 60 to 5,000 requests per hour. Without auth, the package falls back to bundled offline data when rate-limited.

## Auto-Detection Chain

runtime-resolver automatically detects credentials using this priority chain (first match wins):

1. **CLI flags** -- `--token` or `--app-id` + `--app-private-key`
   (+ optional `--app-installation-id`)
2. **App env vars** -- `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`
   (+ optional `GITHUB_APP_INSTALLATION_ID`)
3. **Token env vars** -- `GITHUB_PERSONAL_ACCESS_TOKEN`, then `GITHUB_TOKEN`
4. **Unauthenticated** -- no auth, subject to 60 req/hr rate limit

When multiple credential sources are detected (for example, both app env vars and token env vars are set), a warning is emitted to stderr indicating which source was selected. No warning when CLI flags are provided -- explicit flags are unambiguous.

## Token Authentication

The simplest option. Set an environment variable:

```bash
# Preferred - fine-grained PAT
export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxx

# Fallback - default GitHub token (e.g., in GitHub Actions)
export GITHUB_TOKEN=ghp_xxxx
```

Priority order: `GITHUB_PERSONAL_ACCESS_TOKEN` is checked first, then `GITHUB_TOKEN`. If neither is set, requests are made without authentication.

No special scopes are required. runtime-resolver only accesses public repository data.

### CLI: Explicit Token

Provide a token directly via CLI flag:

```bash
runtime-resolver --node ">=20" --token "ghp_xxxx"
```

### Effect API: Explicit Token

If you are composing layers with the Effect API, you can provide a token directly instead of relying on environment variables:

```typescript
import { GitHubTokenAuthFromToken } from "runtime-resolver";

const layer = GitHubTokenAuthFromToken("ghp_xxxx");
```

This creates an `OctokitInstance` layer authenticated with the given token.

## GitHub App Authentication

For server environments or GitHub Actions with fine-grained permissions, use GitHub App authentication.

### Environment Variables

```bash
export GITHUB_APP_ID="123456"
export GITHUB_APP_PRIVATE_KEY="$(cat /path/to/key.pem)"
# Optional - auto-discovered if omitted
export GITHUB_APP_INSTALLATION_ID="789"
```

### CLI Flags

```bash
# With private key from file (@ prefix)
runtime-resolver --node ">=20" --app-id "123456" --app-private-key @/path/to/key.pem

# With literal private key
runtime-resolver --node ">=20" --app-id "123456" --app-private-key "-----BEGIN RSA..."

# With explicit installation ID
runtime-resolver --node ">=20" --app-id "123456" --app-private-key @key.pem --app-installation-id "789"
```

**Validation rules:**

- `--token` and `--app-id`/`--app-private-key` are mutually exclusive
- `--app-id` and `--app-private-key` must both be provided
- `--app-installation-id` requires `--app-id` and `--app-private-key`

### Effect API: Explicit App Auth

```typescript
import { GitHubAppAuth } from "runtime-resolver";

const layer = GitHubAppAuth({
  appId: "12345",
  privateKey: "-----BEGIN RSA PRIVATE KEY-----...",
  installationId: 67890, // Optional - auto-resolved if omitted
});
```

When `installationId` is omitted, the layer fetches the first available installation automatically. If no installations are found, the layer fails with an `AuthenticationError`.

### Auto-Detection Layer

The `GitHubAutoAuth` layer runs the full detection chain and is the default used by the pre-built `NodeLayer`, `BunLayer`, and `DenoLayer`:

```typescript
import { GitHubAutoAuth } from "runtime-resolver";
```

## AuthenticationError

Authentication failures produce an `AuthenticationError` with a `method` field indicating which authentication method failed:

- `method: "token"` -- HTTP 401 response from the GitHub API
- `method: "app"` -- GitHub App credential failures (invalid private key, no installations found)

## Offline Fallback

When authentication fails or the network is unavailable, runtime-resolver uses bundled version data generated at build time. This data is refreshed each time the package is published.

The fallback is transparent -- the same `ResolvedVersions` interface is returned regardless of data source. The data may be slightly stale but provides a working baseline for CI environments and air-gapped systems.

## GitHub Actions

The built-in `GITHUB_TOKEN` secret is sufficient for most workflows:

```yaml
- uses: actions/checkout@v4
- run: npx runtime-resolver --node ">=20" --pretty
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

For higher rate limits across multiple jobs, use a fine-grained personal access token stored as a repository secret and set `GITHUB_PERSONAL_ACCESS_TOKEN` instead.
