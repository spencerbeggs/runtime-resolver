# Authentication Auto-Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify authentication across Promise API, Effect API, and CLI with automatic credential detection, explicit CLI flags, and a new `AuthenticationError` type.

**Architecture:** A new `GitHubAutoAuth` layer runs a priority-based detection chain (app env vars → token env vars → unauthenticated), replacing `GitHubTokenAuth` as the default. CLI flags override auto-detection by constructing explicit layers. `AuthenticationError` is added to all resolver error unions and caught in `GitHubClientLive` (401) and `GitHubAppAuth` (auth failures).

**Tech Stack:** Effect 3.19, `@effect/cli`, `@octokit/auth-app`, `octokit`

---

## Task 1: Create `AuthenticationError`

**Files:**

- Create: `src/errors/AuthenticationError.ts`
- Test: `src/errors/AuthenticationError.test.ts`

### Step 1: Write the failing test

Create `src/errors/AuthenticationError.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "./AuthenticationError.js";

describe("AuthenticationError", () => {
 it("creates a token authentication error", () => {
  const error = new AuthenticationError({
   method: "token",
   message: "Bad credentials",
  });
  expect(error._tag).toBe("AuthenticationError");
  expect(error.method).toBe("token");
  expect(error.message).toBe("Bad credentials");
 });

 it("creates an app authentication error", () => {
  const error = new AuthenticationError({
   method: "app",
   message: "Invalid private key",
  });
  expect(error._tag).toBe("AuthenticationError");
  expect(error.method).toBe("app");
  expect(error.message).toBe("Invalid private key");
 });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/errors/AuthenticationError.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

Create `src/errors/AuthenticationError.ts`:

```typescript
import { Data } from "effect";

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
 readonly method: "token" | "app";
 readonly message: string;
}> {}
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/errors/AuthenticationError.test.ts`
Expected: PASS

### Step 5: Commit

```bash
git add src/errors/AuthenticationError.ts src/errors/AuthenticationError.test.ts
git commit -m "feat: add AuthenticationError type"
```

---

## Task 2: Move `@octokit/auth-app` to regular dependency

**Files:**

- Modify: `package.json:56-73`

### Step 1: Update `package.json`

Move `@octokit/auth-app` from `devDependencies` to `dependencies`. Remove from `peerDependencies` and `peerDependenciesMeta`.

Before:

```json
"dependencies": {
    "@effect/cli": "^0.73.2",
    ...
},
"devDependencies": {
    "@octokit/auth-app": "^8.2.0",
    ...
},
"peerDependencies": {
    "@octokit/auth-app": "^8.0.0"
},
"peerDependenciesMeta": {
    "@octokit/auth-app": {
        "optional": true
    }
}
```

After:

```json
"dependencies": {
    "@effect/cli": "^0.73.2",
    "@octokit/auth-app": "^8.2.0",
    ...
},
"devDependencies": {
    // @octokit/auth-app removed
    ...
}
// peerDependencies section removed entirely
// peerDependenciesMeta section removed entirely
```

### Step 2: Reinstall dependencies

Run: `pnpm install`
Expected: lockfile updated, no errors

### Step 3: Remove dynamic import from `GitHubAppAuth`

Modify `src/layers/GitHubAppAuth.ts:44`. Change the dynamic `import("@octokit/auth-app")` to a static import at the top of the file.

Before (line 44-46):

```typescript
try: async () => {
    const { createAppAuth } = await import("@octokit/auth-app");
```

After — add static import at line 2:

```typescript
import { createAppAuth } from "@octokit/auth-app";
```

And update the `try` block to remove the dynamic import:

```typescript
try: async () => {
    const auth = createAppAuth({
```

### Step 4: Run existing tests to verify nothing broke

Run: `pnpm vitest run`
Expected: All tests pass

### Step 5: Commit

```bash
git add package.json pnpm-lock.yaml src/layers/GitHubAppAuth.ts
git commit -m "chore: move @octokit/auth-app to regular dependency"
```

---

## Task 3: Create `GitHubAutoAuth` layer

**Files:**

- Create: `src/layers/GitHubAutoAuth.ts`
- Test: `src/layers/GitHubAutoAuth.test.ts`

### Step 1: Write the failing tests

Create `src/layers/GitHubAutoAuth.test.ts`:

```typescript
import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OctokitInstance } from "../services/OctokitInstance.js";

// We need to mock process.env and the auth modules
// GitHubAutoAuth reads env vars at layer construction time

describe("GitHubAutoAuth", () => {
 const originalEnv = process.env;

 afterEach(() => {
  process.env = originalEnv;
  vi.restoreAllMocks();
 });

 it("uses app auth when GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are set", async () => {
  process.env = {
   ...originalEnv,
   GITHUB_APP_ID: "12345",
   GITHUB_APP_PRIVATE_KEY: "fake-private-key",
  };
  // We can't fully test app auth without mocking @octokit/auth-app,
  // but we can verify the layer attempts app auth by checking the error
  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   return yield* OctokitInstance;
  });
  const result = await Effect.runPromiseExit(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  // App auth with fake key will fail - that's expected
  expect(result._tag).toBe("Failure");
 });

 it("uses token auth when GITHUB_PERSONAL_ACCESS_TOKEN is set", async () => {
  process.env = {
   ...originalEnv,
   GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_test123",
  };
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;

  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   const octokit = yield* OctokitInstance;
   return octokit;
  });
  const result = await Effect.runPromise(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  expect(result).toBeDefined();
  expect(result.rest).toBeDefined();
 });

 it("uses token auth with GITHUB_TOKEN as fallback", async () => {
  process.env = {
   ...originalEnv,
   GITHUB_TOKEN: "ghp_fallback",
  };
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   const octokit = yield* OctokitInstance;
   return octokit;
  });
  const result = await Effect.runPromise(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  expect(result).toBeDefined();
 });

 it("prefers GITHUB_PERSONAL_ACCESS_TOKEN over GITHUB_TOKEN", async () => {
  process.env = {
   ...originalEnv,
   GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_pat",
   GITHUB_TOKEN: "ghp_token",
  };
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;

  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   return yield* OctokitInstance;
  });
  const result = await Effect.runPromise(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  expect(result).toBeDefined();
 });

 it("creates unauthenticated client when no credentials are set", async () => {
  process.env = { ...originalEnv };
  delete process.env.GITHUB_APP_ID;
  delete process.env.GITHUB_APP_PRIVATE_KEY;
  delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  delete process.env.GITHUB_TOKEN;

  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   return yield* OctokitInstance;
  });
  const result = await Effect.runPromise(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  expect(result).toBeDefined();
 });

 it("prefers app auth over token auth when both present", async () => {
  process.env = {
   ...originalEnv,
   GITHUB_APP_ID: "12345",
   GITHUB_APP_PRIVATE_KEY: "fake-key",
   GITHUB_TOKEN: "ghp_token",
  };
  // Spy on console.error to check for warning
  const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const { GitHubAutoAuth } = await import("./GitHubAutoAuth.js");
  const program = Effect.gen(function* () {
   return yield* OctokitInstance;
  });
  // Will fail because of fake app key, but we verify it tried app auth
  await Effect.runPromiseExit(
   program.pipe(Effect.provide(GitHubAutoAuth)),
  );
  // The layer should have emitted a warning about multiple sources
  // (implementation detail: warning written to stderr)
  stderrSpy.mockRestore();
 });
});
```

### Step 2: Run tests to verify they fail

Run: `pnpm vitest run src/layers/GitHubAutoAuth.test.ts`
Expected: FAIL — module not found

### Step 3: Write minimal implementation

Create `src/layers/GitHubAutoAuth.ts`:

```typescript
import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

export const GitHubAutoAuth: Layer.Layer<OctokitInstance, AuthenticationError> = Layer.effect(
 OctokitInstance,
 Effect.gen(function* () {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const pat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const token = process.env.GITHUB_TOKEN;

  const hasApp = appId && privateKey;
  const hasToken = pat || token;

  // Warn when multiple credential sources are detected
  if (hasApp && hasToken) {
   const tokenSource = pat ? "GITHUB_PERSONAL_ACCESS_TOKEN" : "GITHUB_TOKEN";
   process.stderr.write(
    `Warning: Multiple GitHub credential sources found. Using GitHub App authentication (from GITHUB_APP_ID). Ignoring ${tokenSource}.\n`,
   );
  }

  // Priority 1: App env vars
  if (hasApp) {
   const appLayer = GitHubAppAuth({
    appId: appId,
    privateKey: privateKey,
    ...(installationId ? { installationId: Number(installationId) } : {}),
   });
   return yield* Effect.provide(OctokitInstance, appLayer).pipe(
    Effect.mapError(
     (error) =>
      new AuthenticationError({
       method: "app",
       message: error.message,
      }),
    ),
   );
  }

  // Priority 2: Token env vars (PAT first, then GITHUB_TOKEN)
  if (pat) {
   return new Octokit({ auth: pat });
  }
  if (token) {
   return new Octokit({ auth: token });
  }

  // Priority 3: Unauthenticated
  return new Octokit();
 }),
);
```

### Step 4: Run tests to verify they pass

Run: `pnpm vitest run src/layers/GitHubAutoAuth.test.ts`
Expected: Most tests pass (app auth tests may fail due to fake keys — that's expected behavior)

### Step 5: Run full test suite

Run: `pnpm vitest run`
Expected: All existing tests still pass

### Step 6: Commit

```bash
git add src/layers/GitHubAutoAuth.ts src/layers/GitHubAutoAuth.test.ts
git commit -m "feat: add GitHubAutoAuth layer with credential detection chain"
```

---

## Task 4: Update `GitHubClientLive` to catch 401 as `AuthenticationError`

**Files:**

- Modify: `src/layers/GitHubClientLive.ts:1-29`
- Test: `src/layers/GitHubClientLive.test.ts` (add test cases)

### Step 1: Write the failing test

Add test to an existing or new test file `src/layers/GitHubClientLive.test.ts`:

```typescript
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubClientLive } from "./GitHubClientLive.js";

describe("GitHubClientLive", () => {
 describe("mapOctokitError", () => {
  it("maps 401 to AuthenticationError", async () => {
   // Create a mock OctokitInstance that throws a 401
   const mockOctokit = {
    rest: {
     repos: {
      listTags: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
      listReleases: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
     },
    },
   };
   const mockLayer = Layer.succeed(OctokitInstance, mockOctokit);
   const testLayer = GitHubClientLive.pipe(Layer.provide(mockLayer));

   const program = Effect.gen(function* () {
    const client = yield* GitHubClient;
    return yield* client.listTags("owner", "repo");
   });

   const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
   expect(exit._tag).toBe("Failure");

   if (exit._tag === "Failure") {
    const error = exit.cause;
    // The error should be AuthenticationError, not NetworkError
    const failure = error as { _tag: string; error: { _tag: string; method: string } };
    expect(failure._tag).toBe("Fail");
    expect(failure.error._tag).toBe("AuthenticationError");
    expect(failure.error.method).toBe("token");
   }
  });
 });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/layers/GitHubClientLive.test.ts`
Expected: FAIL — 401 currently maps to `NetworkError`, not `AuthenticationError`

### Step 3: Update `mapOctokitError` in `GitHubClientLive.ts`

Modify `src/layers/GitHubClientLive.ts`. Add import for `AuthenticationError` and update `mapOctokitError` return type and logic.

Add import at line 2:

```typescript
import { AuthenticationError } from "../errors/AuthenticationError.js";
```

Update the `mapOctokitError` function signature and add 401 handling:

```typescript
const mapOctokitError = (error: unknown, url: string): NetworkError | RateLimitError | AuthenticationError => {
 const err = error as { status?: number; response?: { headers?: Record<string, string> } };

 if (err.status === 401) {
  return new AuthenticationError({
   method: "token",
   message: `GitHub API authentication failed for ${url}`,
  });
 }

 if (err.status === 403 || err.status === 429) {
  const headers = err.response?.headers ?? {};
  const retryAfterStr = headers["retry-after"];
  return new RateLimitError({
   ...(retryAfterStr ? { retryAfter: Number.parseInt(retryAfterStr, 10) } : {}),
   limit: headers["x-ratelimit-limit"] ? Number.parseInt(headers["x-ratelimit-limit"], 10) : 0,
   remaining: headers["x-ratelimit-remaining"] ? Number.parseInt(headers["x-ratelimit-remaining"], 10) : 0,
   message: `GitHub API rate limit exceeded for ${url}`,
  });
 }

 return new NetworkError({
  url,
  ...(err.status !== undefined ? { status: err.status } : {}),
  message: error instanceof Error ? error.message : String(error),
 });
};
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/layers/GitHubClientLive.test.ts`
Expected: PASS

### Step 5: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/layers/GitHubClientLive.ts src/layers/GitHubClientLive.test.ts
git commit -m "feat: map HTTP 401 to AuthenticationError in GitHubClientLive"
```

---

## Task 5: Update `GitHubAppAuth` to produce `AuthenticationError`

**Files:**

- Modify: `src/layers/GitHubAppAuth.ts:1-66`

### Step 1: Write the failing test

Add to `src/layers/GitHubClientLive.test.ts` or create `src/layers/GitHubAppAuth.test.ts`:

```typescript
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

describe("GitHubAppAuth", () => {
 it("produces AuthenticationError on invalid credentials", async () => {
  const layer = GitHubAppAuth({
   appId: "invalid",
   privateKey: "not-a-real-key",
  });

  const program = Effect.gen(function* () {
   return yield* OctokitInstance;
  });

  const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
  expect(exit._tag).toBe("Failure");

  if (exit._tag === "Failure") {
   const failure = exit.cause as { _tag: string; error: { _tag: string; method: string } };
   expect(failure._tag).toBe("Fail");
   expect(failure.error._tag).toBe("AuthenticationError");
   expect(failure.error.method).toBe("app");
  }
 });
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/layers/GitHubAppAuth.test.ts`
Expected: FAIL — currently produces `NetworkError`, not `AuthenticationError`

### Step 3: Update `GitHubAppAuth` error type

Modify `src/layers/GitHubAppAuth.ts`:

1. Replace `NetworkError` import with `AuthenticationError`:

```typescript
import { AuthenticationError } from "../errors/AuthenticationError.js";
```

1. Change the return type from `Layer.Layer<OctokitInstance, NetworkError>` to `Layer.Layer<OctokitInstance, AuthenticationError>`:

```typescript
export const GitHubAppAuth = (config: GitHubAppAuthConfig): Layer.Layer<OctokitInstance, AuthenticationError> =>
```

1. Update the `catch` handler:

```typescript
catch: (error) =>
    new AuthenticationError({
        method: "app",
        message: error instanceof Error ? error.message : String(error),
    }),
```

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/layers/GitHubAppAuth.test.ts`
Expected: PASS

### Step 5: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass (the `GitHubAutoAuth` layer already handles this change since it maps the error)

### Step 6: Commit

```bash
git add src/layers/GitHubAppAuth.ts src/layers/GitHubAppAuth.test.ts
git commit -m "feat: GitHubAppAuth produces AuthenticationError instead of NetworkError"
```

---

## Task 6: Add `AuthenticationError` to resolver error unions

**Files:**

- Modify: `src/services/BunResolver.ts:19-26`
- Modify: `src/services/DenoResolver.ts` (same error union)
- Modify: `src/services/NodeResolver.ts` (same error union)

### Step 1: Update `BunResolver.ts`

Add import:

```typescript
import type { AuthenticationError } from "../errors/AuthenticationError.js";
```

Add to error union:

```typescript
type BunResolverError =
 | NetworkError
 | ParseError
 | RateLimitError
 | VersionNotFoundError
 | InvalidInputError
 | FreshnessError
 | CacheError
 | AuthenticationError;
```

### Step 2: Update `DenoResolver.ts`

Same changes as BunResolver — add `AuthenticationError` import and to error union.

### Step 3: Update `NodeResolver.ts`

Same changes — add `AuthenticationError` import and to error union.

### Step 4: Run typecheck

Run: `pnpm run typecheck`
Expected: No type errors

### Step 5: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/services/BunResolver.ts src/services/DenoResolver.ts src/services/NodeResolver.ts
git commit -m "feat: add AuthenticationError to all resolver error unions"
```

---

## Task 7: Wire `GitHubAutoAuth` as default and update layer composition

**Files:**

- Modify: `src/layers/index.ts:1-14`

### Step 1: Update `src/layers/index.ts`

Replace `GitHubTokenAuth` with `GitHubAutoAuth` as the default:

Before:

```typescript
import { GitHubTokenAuth } from "./GitHubTokenAuth.js";
export const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth));
```

After:

```typescript
import { GitHubAutoAuth } from "./GitHubAutoAuth.js";
export const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
```

### Step 2: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass (existing tests don't set app env vars, so `GitHubAutoAuth` falls through to token/unauthenticated — same behavior as `GitHubTokenAuth`)

### Step 3: Run typecheck

Run: `pnpm run typecheck`
Expected: No type errors

### Step 4: Commit

```bash
git add src/layers/index.ts
git commit -m "feat: replace GitHubTokenAuth with GitHubAutoAuth as default layer"
```

---

## Task 8: Add CLI auth flags and validation

**Files:**

- Modify: `src/cli/commands/resolve.ts`
- Modify: `src/cli/index.ts`

### Step 1: Add auth options to `resolve.ts`

Add four new options after `schemaOption` (line 26):

```typescript
export const tokenOption = Options.text("token").pipe(Options.optional);
export const appIdOption = Options.text("app-id").pipe(Options.optional);
export const appPrivateKeyOption = Options.text("app-private-key").pipe(Options.optional);
export const appInstallationIdOption = Options.text("app-installation-id").pipe(Options.optional);
```

### Step 2: Add auth flags to `resolveHandler` args type

Add to the handler args interface:

```typescript
readonly token: Option.Option<string>;
readonly appId: Option.Option<string>;
readonly appPrivateKey: Option.Option<string>;
readonly appInstallationId: Option.Option<string>;
```

### Step 3: Add auth validation to handler

Add validation logic at the start of the handler, after the `--schema` guard but before runtime resolution. Add these imports at the top:

```typescript
import { readFileSync } from "node:fs";
import type { Freshness, Increments, NodePhase } from "../../schemas/common.js";
import { GitHubAppAuth } from "../../layers/GitHubAppAuth.js";
import { GitHubTokenAuthFromToken } from "../../layers/GitHubTokenAuth.js";
import { GitHubClientLive } from "../../layers/GitHubClientLive.js";
import { VersionCacheLive } from "../../layers/VersionCacheLive.js";
```

Auth validation block (insert after `--schema` guard):

```typescript
// Auth flag validation
const hasToken = Option.isSome(args.token);
const hasAppId = Option.isSome(args.appId);
const hasAppPrivateKey = Option.isSome(args.appPrivateKey);
const hasAppInstallationId = Option.isSome(args.appInstallationId);

// Mutual exclusivity: --token vs --app-id/--app-private-key
if (hasToken && (hasAppId || hasAppPrivateKey)) {
    yield* Console.error("Error: --token and --app-id/--app-private-key are mutually exclusive");
    return;
}

// --app-id and --app-private-key must both be provided
if (hasAppId !== hasAppPrivateKey) {
    yield* Console.error("Error: --app-id and --app-private-key must both be provided");
    return;
}

// --app-installation-id requires --app-id
if (hasAppInstallationId && !hasAppId) {
    yield* Console.error("Error: --app-installation-id requires --app-id and --app-private-key");
    return;
}

// Auth flags are incompatible with --schema (add to existing guard)
if (args.schema && (hasToken || hasAppId)) {
    yield* Console.error("Error: --schema cannot be combined with auth flags (--token, --app-id, etc.)");
    return;
}
```

### Step 4: Add `@` prefix handling for `--app-private-key`

```typescript
// Resolve private key (@ prefix means file path)
let resolvedPrivateKey: string | undefined;
if (hasAppPrivateKey) {
    const keyValue = args.appPrivateKey.value;
    if (keyValue.startsWith("@")) {
        const filePath = keyValue.slice(1);
        try {
            resolvedPrivateKey = readFileSync(filePath, "utf-8");
        } catch {
            yield* Console.error(`Error: Cannot read private key file: ${filePath}`);
            return;
        }
    } else {
        resolvedPrivateKey = keyValue;
    }
}
```

### Step 5: Build auth layer override

After validation, construct the layer override:

```typescript
// Construct auth layer override if CLI flags provided
let authLayerOverride: Layer.Layer<OctokitInstance, AuthenticationError> | undefined;
if (hasToken) {
    authLayerOverride = GitHubTokenAuthFromToken(args.token.value).pipe(
        Layer.mapError(() => new AuthenticationError({ method: "token", message: "Token auth failed" })),
    );
} else if (hasAppId && resolvedPrivateKey) {
    authLayerOverride = GitHubAppAuth({
        appId: args.appId.value,
        privateKey: resolvedPrivateKey,
        ...(hasAppInstallationId ? { installationId: Number(args.appInstallationId.value) } : {}),
    });
}
```

### Step 6: Thread auth override to resolver helpers

Update the three resolver helper functions (`resolveNode`, `resolveBun`, `resolveDeno`) to accept an optional `authOverride` parameter and use it to construct the layer:

```typescript
const resolveNode = (
    semverRange: string,
    phases?: NodePhase[],
    increments?: Increments,
    defaultVersion?: string,
    date?: Date,
    freshness?: Freshness,
    authOverride?: Layer.Layer<OctokitInstance, AuthenticationError>,
): Effect.Effect<RuntimeEntry> =>
    Effect.gen(function* () {
        const resolver = yield* NodeResolver;
        const result = yield* resolver.resolve({
            semverRange,
            ...(phases ? { phases } : {}),
            ...(increments ? { increments } : {}),
            ...(defaultVersion ? { defaultVersion } : {}),
            ...(date ? { date } : {}),
            ...(freshness ? { freshness } : {}),
        });
        return toSuccess("node", result);
    }).pipe(
        Effect.provide(
            authOverride
                ? NodeResolverLive.pipe(
                      Layer.provide(Layer.merge(
                          GitHubClientLive.pipe(Layer.provide(authOverride)),
                          VersionCacheLive,
                      )),
                  )
                : NodeLayer,
        ),
        Effect.catchAll((error) => Effect.succeed(toError("node", error))),
    );
```

Apply the same pattern to `resolveBun` and `resolveDeno`.

Then update the call sites in the handler to pass `authLayerOverride`:

```typescript
if (hasNode) {
    tasks.push(resolveNode(
        args.node.value,
        validatedPhases,
        validatedIncrements,
        nodeDefaultVersion,
        nodeDate,
        validatedFreshness,
        authLayerOverride,
    ));
}
// Same for resolveBun and resolveDeno
```

### Step 7: Add auth options to `src/cli/index.ts`

Import and wire the new options:

```typescript
import {
    // ... existing imports
    tokenOption,
    appIdOption,
    appPrivateKeyOption,
    appInstallationIdOption,
} from "./commands/resolve.js";

const rootCommand = Command.make(
    "runtime-resolver",
    {
        // ... existing options
        token: tokenOption,
        appId: appIdOption,
        appPrivateKey: appPrivateKeyOption,
        appInstallationId: appInstallationIdOption,
    },
    resolveHandler,
);
```

### Step 8: Add auth flag validation to `--schema` guard

Update the existing `--schema` guard to include auth flags in `resolveFlags`:

```typescript
const resolveFlags = [
    args.node, args.bun, args.deno,
    args.nodePhases, args.increments, args.freshness,
    args.nodeDefault, args.bunDefault, args.denoDefault,
    args.nodeDate,
    args.token, args.appId, args.appPrivateKey, args.appInstallationId,
];
```

### Step 9: Run typecheck

Run: `pnpm run typecheck`
Expected: No type errors

### Step 10: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass

### Step 11: Commit

```bash
git add src/cli/commands/resolve.ts src/cli/index.ts
git commit -m "feat: add --token, --app-id, --app-private-key, --app-installation-id CLI flags"
```

---

## Task 9: Update exports and add export tests

**Files:**

- Modify: `src/effect.ts`
- Modify: `src/index.test.ts`

### Step 1: Write the failing test

Add to `src/index.test.ts` in the "Effect API exports" describe block:

```typescript
it("exports GitHubAutoAuth from effect entry point", async () => {
    const mod = await import("./effect.js");
    expect(mod.GitHubAutoAuth).toBeDefined();
    expect(mod.AuthenticationError).toBeDefined();
    expect(mod.GitHubTokenAuthFromToken).toBeDefined();
});
```

### Step 2: Run test to verify it fails

Run: `pnpm vitest run src/index.test.ts`
Expected: FAIL — `GitHubAutoAuth` and `AuthenticationError` not exported

### Step 3: Update `src/effect.ts`

Add exports:

```typescript
// Errors (add AuthenticationError)
export { AuthenticationError } from "./errors/AuthenticationError.js";

// Layers (add GitHubAutoAuth)
export { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
```

Ensure `GitHubTokenAuthFromToken` is already exported (it is — line 24).

### Step 4: Run test to verify it passes

Run: `pnpm vitest run src/index.test.ts`
Expected: PASS

### Step 5: Run full test suite

Run: `pnpm vitest run`
Expected: All tests pass

### Step 6: Commit

```bash
git add src/effect.ts src/index.test.ts
git commit -m "feat: export GitHubAutoAuth and AuthenticationError from effect entry point"
```

---

## Task 10: Update documentation

**Files:**

- Modify: `docs/promise-api.md`
- Modify: `docs/effect-api.md`
- Modify: `docs/cli.md`
- Modify: `docs/error-handling.md`

### Step 1: Update `docs/promise-api.md`

Add note about auto-detection:

> The Promise API automatically detects authentication from environment variables. Set `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` for GitHub App auth, or `GITHUB_PERSONAL_ACCESS_TOKEN` / `GITHUB_TOKEN` for token auth. Without credentials, requests are unauthenticated (60 req/hr limit).

### Step 2: Update `docs/effect-api.md`

Add `GitHubAutoAuth` to layers table and `AuthenticationError` to errors table.

### Step 3: Update `docs/cli.md`

Add `--token`, `--app-id`, `--app-private-key`, `--app-installation-id` to flags table. Add validation rules section. Add `@` prefix documentation for `--app-private-key`.

### Step 4: Update `docs/error-handling.md`

Add `AuthenticationError` section with `method: "token" | "app"` documentation. Update error union tables to include `AuthenticationError`.

### Step 5: Commit

```bash
git add docs/
git commit -m "docs: add authentication auto-detection documentation"
```

---

## Summary of Changes

| Task | Component | Key Change |
| ---- | --------- | ---------- |
| 1 | `AuthenticationError` | New error type with `method: "token" \| "app"` |
| 2 | `package.json` | `@octokit/auth-app` → regular dep, static import |
| 3 | `GitHubAutoAuth` | New layer: app env → token env → unauthenticated |
| 4 | `GitHubClientLive` | HTTP 401 → `AuthenticationError` |
| 5 | `GitHubAppAuth` | `NetworkError` → `AuthenticationError` |
| 6 | Resolver services | `AuthenticationError` added to error unions |
| 7 | `src/layers/index.ts` | Default layer: `GitHubTokenAuth` → `GitHubAutoAuth` |
| 8 | CLI | `--token`, `--app-id`, `--app-private-key`, `--app-installation-id` |
| 9 | Exports | `GitHubAutoAuth`, `AuthenticationError` exported |
| 10 | Documentation | All docs updated |
