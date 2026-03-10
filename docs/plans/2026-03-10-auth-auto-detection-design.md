# Authentication Auto-Detection Design

**Goal:** Unify authentication across Promise API, Effect API, and CLI with
automatic credential detection, explicit CLI flags, and a new
`AuthenticationError` type.

**Date:** 2026-03-10

## Authentication Priority Chain

First match wins:

1. **Explicit CLI flags** -- `--token` or `--app-id` + `--app-private-key`
   (+ optional `--app-installation-id`)
2. **App env vars** -- `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY`
   (+ optional `GITHUB_APP_INSTALLATION_ID`)
3. **Token env vars** -- `GITHUB_PERSONAL_ACCESS_TOKEN`, then `GITHUB_TOKEN`
4. **Unauthenticated** -- no auth, subject to 60 req/hr rate limit

When multiple credential sources are detected (e.g. both app env vars and token
env vars are set), a warning is emitted to stderr indicating which source was
selected.

## API Surface

### Promise API

Auto-detects from env vars only (steps 2-4). No programmatic auth override.
Users needing explicit auth control use the Effect API with specific layers.

### Effect API

All existing layers remain exported:

- `GitHubAutoAuth` (new) -- full detection chain, replaces `GitHubTokenAuth`
  as the default in shared layer composition
- `GitHubTokenAuth` -- token env var detection only (existing)
- `GitHubTokenAuthFromToken(token)` -- explicit token (existing)
- `GitHubAppAuth(config)` -- explicit app auth (existing)

### CLI

New flags, validated in the handler:

| Flag | Type | Description |
| --- | --- | --- |
| `--token` | `string` (optional) | GitHub personal access token |
| `--app-id` | `string` (optional) | GitHub App ID |
| `--app-private-key` | `string` (optional) | PEM key: literal or `@/path/to/key.pem` |
| `--app-installation-id` | `string` (optional) | Installation ID (auto-discovered if omitted) |

## Architecture

### New layer: `GitHubAutoAuth`

Runs the full detection chain and produces `OctokitInstance`. Emits a warning
to stderr when multiple credential sources are present.

Replaces `GitHubTokenAuth` as the default in `src/layers/index.ts`:

```typescript
export const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
```

### CLI auth override

When CLI flags are provided, the handler constructs the appropriate layer
(`GitHubTokenAuthFromToken` or `GitHubAppAuth`) and uses it instead of the
default `GitHubAutoAuth`. The resolver helpers in resolve.ts accept an
optional auth layer override.

### `@octokit/auth-app` dependency change

Move from optional peer dependency to regular dependency. Remove from
`peerDependencies` and `peerDependenciesMeta`. Add to `dependencies`.

## CLI Validation Rules

1. `--token` and `--app-id`/`--app-private-key` are mutually exclusive:
   `"Error: --token and --app-id/--app-private-key are mutually exclusive"`
2. `--app-id` requires `--app-private-key` and vice versa:
   `"Error: --app-id and --app-private-key must both be provided"`
3. `--app-installation-id` requires `--app-id`:
   `"Error: --app-installation-id requires --app-id and --app-private-key"`
4. Auth flags are incompatible with `--schema` (added to existing guard).

## `@` Prefix for Private Key

If the `--app-private-key` value starts with `@`, strip the prefix, read the
file, and use the contents. Otherwise use the literal value. File read errors
produce: `"Error: Cannot read private key file: /path/to/key.pem"`.

## Value Masking

When logging or warning about auth source selection, never include token values
or private key content. Log only the source type:

- `"Using GitHub App authentication (from --app-id flag)"`
- `"Using token authentication (from GITHUB_TOKEN)"`

## New Error: `AuthenticationError`

```typescript
export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
  readonly method: "token" | "app";
  readonly message: string;
}> {}
```

Added to all three resolver error unions. `GitHubClientLive` catches HTTP 401
responses and reclassifies them as `AuthenticationError` with
`method: "token"`. `GitHubAppAuth` catches app auth failures (bad key, no
installations) and produces `AuthenticationError` with `method: "app"`.

## Warning Behavior

When `GitHubAutoAuth` detects multiple credential sources, it emits to stderr:

```text
Warning: Multiple GitHub credential sources found. Using GitHub App
authentication (from GITHUB_APP_ID). Ignoring GITHUB_TOKEN.
```

No warning when CLI flags are provided -- explicit flags are unambiguous.

## Testing

- `GitHubAutoAuth`: app env → app auth; token env → token auth; both → app
  auth + warning; neither → unauthenticated; PAT priority over GITHUB_TOKEN
- CLI flags: `--token` overrides env; `--app-id` + `--app-private-key`
  overrides env; mutual exclusivity errors; missing pair errors;
  `@` file reading; literal value; auth flags + `--schema` error
- `AuthenticationError`: bad app credentials → `method: "app"`; HTTP 401 →
  `method: "token"`
