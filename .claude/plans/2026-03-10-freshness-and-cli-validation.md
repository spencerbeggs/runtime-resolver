# Freshness Control & CLI Flag Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `freshness` option (`"auto" | "api" | "cache"`) to control data sourcing, a `FreshnessError` for failed API-only requests, and strict CLI flag validation preventing `--schema` from combining with resolve flags.

**Architecture:** Add `Freshness` schema to `src/schemas/common.ts`. Create `FreshnessError` in `src/errors/`. Add `freshness` to all resolver options and thread it through each layer's fetch function. The fetch functions already have the try-API/fallback-cache structure — freshness just selects which branches execute. CLI validation is a guard at the top of `resolveHandler`.

**Tech Stack:** Effect 3.19, @effect/cli, semver, TypeScript, Vitest

---

### Task 1: Add `Freshness` schema and `FreshnessError`

**Files:**
- Modify: `src/schemas/common.ts`
- Create: `src/errors/FreshnessError.ts`

**Step 1: Add `Freshness` to `src/schemas/common.ts`**

After the `Source` schema (line 7), add:

```typescript
export const Freshness = Schema.Literal("auto", "api", "cache");
export type Freshness = typeof Freshness.Type;
```

**Step 2: Create `src/errors/FreshnessError.ts`**

```typescript
import { Data } from "effect";
import type { Freshness } from "../schemas/common.js";

export class FreshnessError extends Data.TaggedError("FreshnessError")<{
	readonly strategy: Freshness;
	readonly message: string;
}> {}
```

**Step 3: Run typecheck**

Run: `pnpm run typecheck`
Expected: Clean.

**Step 4: Commit**

```bash
git add src/schemas/common.ts src/errors/FreshnessError.ts
git commit -m "feat: add Freshness schema and FreshnessError

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 2: Add `freshness` to all resolver service interfaces

**Files:**
- Modify: `src/services/BunResolver.ts`
- Modify: `src/services/DenoResolver.ts`
- Modify: `src/services/NodeResolver.ts`

**Step 1: Update `BunResolverOptions`**

In `src/services/BunResolver.ts`, add `freshness` to the options interface and `FreshnessError` to the error union:

```typescript
import type { FreshnessError } from "../errors/FreshnessError.js";
import type { Freshness, Increments, ResolvedVersions } from "../schemas/common.js";

export interface BunResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
	readonly freshness?: Freshness;
}

type BunResolverError =
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;
```

**Step 2: Same for `DenoResolverOptions`**

Same pattern in `src/services/DenoResolver.ts`.

**Step 3: Same for `NodeResolverOptions`**

Same pattern in `src/services/NodeResolver.ts`.

**Step 4: Run typecheck**

Run: `pnpm run typecheck`
Expected: Clean.

**Step 5: Commit**

```bash
git add src/services/BunResolver.ts src/services/DenoResolver.ts src/services/NodeResolver.ts
git commit -m "feat: add freshness option and FreshnessError to all resolver interfaces

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 3: Implement freshness in BunResolverLive

**Files:**
- Modify: `src/layers/BunResolverLive.ts`
- Test: `src/services/BunResolver.test.ts`

**Step 1: Refactor `fetchBunTags` to accept freshness**

In `src/layers/BunResolverLive.ts`, change `fetchBunTags` from a no-arg function to accept a `Freshness` parameter. Import `FreshnessError` and `Freshness` type:

```typescript
import { FreshnessError } from "../errors/FreshnessError.js";
import type { Freshness } from "../schemas/common.js";
```

Replace `fetchBunTags`:

```typescript
const fetchBunTags = (freshness: Freshness = "auto") => {
	if (freshness === "cache") {
		return Effect.gen(function* () {
			const { data: cached, source } = yield* cache.get("bun");
			return { tags: (cached as CachedTagData).tags, source };
		}).pipe(
			Effect.catchTag("CacheError", () =>
				Effect.succeed({ tags: [] as ReadonlyArray<GitHubTag>, source: "cache" as const }),
			),
		);
	}

	const apiCall = retryOnRateLimit(client.listTags("oven-sh", "bun", { perPage: 100, pages: 3 })).pipe(
		Effect.tap((tags) => cache.set("bun", { tags: tags as GitHubTag[] })),
		Effect.map((tags) => ({ tags, source: "api" as const })),
	);

	if (freshness === "api") {
		return apiCall.pipe(
			Effect.catchTag("NetworkError", (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but network unavailable: ${err.message}`,
					}),
				),
			),
		);
	}

	// freshness === "auto" (default — current behavior)
	return apiCall.pipe(
		Effect.catchTag("NetworkError", () =>
			Effect.gen(function* () {
				const { data: cached, source } = yield* cache.get("bun");
				return { tags: (cached as CachedTagData).tags, source };
			}),
		),
		Effect.catchTag("CacheError", () =>
			Effect.succeed({ tags: [] as ReadonlyArray<GitHubTag>, source: "cache" as const }),
		),
	);
};
```

**Step 2: Thread freshness through `resolve` and `resolveVersion`**

In the `resolve` method, change:
```typescript
const { tags, source } = yield* fetchBunTags();
```
to:
```typescript
const { tags, source } = yield* fetchBunTags(options?.freshness);
```

In the `resolveVersion` method, both calls to `fetchBunTags()` become `fetchBunTags()` (no freshness — `resolveVersion` always uses `"auto"` since it has no options object).

**Step 3: Write tests**

In `src/services/BunResolver.test.ts`, add these tests:

```typescript
describe("freshness", () => {
	it("freshness 'cache' returns cached data without network", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* BunResolver;
				return yield* resolver.resolve({ freshness: "cache" });
			}).pipe(Effect.provide(makeTestLayer())),
		);
		expect(result.source).toBe("cache");
		expect(result.versions.length).toBeGreaterThan(0);
	});

	it("freshness 'api' fails with FreshnessError on network failure", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* BunResolver;
				return yield* resolver.resolve({ freshness: "api" });
			}).pipe(Effect.provide(makeNetworkErrorLayer()), Effect.flip),
		);
		expect(result._tag).toBe("FreshnessError");
	});

	it("freshness 'auto' falls back to cache on network failure", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* BunResolver;
				return yield* resolver.resolve({ freshness: "auto" });
			}).pipe(Effect.provide(makeNetworkErrorLayer())),
		);
		expect(result.source).toBe("cache");
	});
});
```

Note: You need to check what `makeNetworkErrorLayer` or equivalent exists in the test file. Look at the existing "falls back to cache on network error" test to find the layer name and pattern. Use the same approach. If a network-error layer doesn't exist as a named function, extract one from the existing test.

**Step 4: Run tests**

Run: `pnpm vitest run src/services/BunResolver.test.ts`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/layers/BunResolverLive.ts src/services/BunResolver.test.ts
git commit -m "feat: implement freshness control in BunResolverLive

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 4: Implement freshness in DenoResolverLive

**Files:**
- Modify: `src/layers/DenoResolverLive.ts`
- Test: `src/services/DenoResolver.test.ts`

**Step 1: Apply the same refactor as Task 3**

Identical pattern to `BunResolverLive`. Change `fetchDenoTags` to accept `freshness: Freshness = "auto"`. Add the three branches: `"cache"` skips network, `"api"` wraps `NetworkError` in `FreshnessError`, `"auto"` is current behavior.

Import `FreshnessError` and `Freshness` type.

Thread `options?.freshness` through to `fetchDenoTags` in `resolve`. Leave `resolveVersion` calling `fetchDenoTags()` with no arg (auto).

**Step 2: Write the same three tests**

Same pattern as Task 3 but for `DenoResolver`. Use the existing network-error test layer pattern from the Deno test file.

**Step 3: Run tests**

Run: `pnpm vitest run src/services/DenoResolver.test.ts`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/layers/DenoResolverLive.ts src/services/DenoResolver.test.ts
git commit -m "feat: implement freshness control in DenoResolverLive

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 5: Implement freshness in NodeResolverLive

**Files:**
- Modify: `src/layers/NodeResolverLive.ts`
- Test: `src/services/NodeResolver.test.ts`

**Step 1: Refactor `fetchWithCacheFallback` to accept freshness**

Node's fetch is different — it uses `fetchNodeData()` (two API calls) wrapped in `fetchWithCacheFallback()`. Refactor `fetchWithCacheFallback` to accept `freshness: Freshness = "auto"`:

```typescript
import { FreshnessError } from "../errors/FreshnessError.js";
import type { Freshness } from "../schemas/common.js";

const fetchWithCacheFallback = (freshness: Freshness = "auto") =>
	Effect.gen(function* () {
		if (freshness === "cache") {
			const { data: cached, source } = yield* cache.get("node");
			const nodeCache = cached as CachedNodeData;
			return { allVersions: nodeCache.versions, schedule: nodeCache.schedule, source };
		}

		const fromNetwork = fetchNodeData().pipe(
			Effect.tap(({ allVersions, schedule }) => cache.set("node", { versions: allVersions, schedule })),
			Effect.map(({ allVersions, schedule }) => ({ allVersions, schedule, source: "api" as const })),
		);

		if (freshness === "api") {
			return yield* fromNetwork.pipe(
				Effect.catchTag("NetworkError", (err) =>
					Effect.fail(
						new FreshnessError({
							strategy: "api",
							message: `Fresh data required but network unavailable: ${err.message}`,
						}),
					),
				),
			);
		}

		// "auto" — current behavior
		return yield* fromNetwork.pipe(
			Effect.catchTag("NetworkError", () =>
				Effect.gen(function* () {
					const { data: cached, source } = yield* cache.get("node");
					const nodeCache = cached as CachedNodeData;
					return { allVersions: nodeCache.versions, schedule: nodeCache.schedule, source };
				}),
			),
		);
	});
```

**Step 2: Thread freshness**

In `resolve`, change `fetchWithCacheFallback()` to `fetchWithCacheFallback(options?.freshness)`.

In `resolveVersion`, leave as `fetchWithCacheFallback()` (auto default).

**Step 3: Write the same three freshness tests**

Same pattern as Tasks 3-4 but for `NodeResolver`.

**Step 4: Run tests**

Run: `pnpm vitest run src/services/NodeResolver.test.ts`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add src/layers/NodeResolverLive.ts src/services/NodeResolver.test.ts
git commit -m "feat: implement freshness control in NodeResolverLive

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 6: Add `--freshness` to CLI and strict `--schema` validation

**Files:**
- Modify: `src/cli/commands/resolve.ts`
- Modify: `src/cli/index.ts`

**Step 1: Add freshness option and validation constants**

In `src/cli/commands/resolve.ts`, add the option:

```typescript
export const freshnessOption = Options.text("freshness").pipe(Options.optional);
```

Add to the validation constants:

```typescript
const VALID_FRESHNESS = ["auto", "api", "cache"] as const;

const validateFreshness = (raw: string): Freshness => {
	if (!(VALID_FRESHNESS as readonly string[]).includes(raw)) {
		throw new Error(`Invalid freshness value: "${raw}". Valid values: ${VALID_FRESHNESS.join(", ")}`);
	}
	return raw as Freshness;
};
```

Import `Freshness` type:

```typescript
import type { Freshness, Increments, NodePhase } from "../../schemas/common.js";
```

**Step 2: Add strict `--schema` validation**

At the top of `resolveHandler`, after the `args.schema` early return block, add a guard BEFORE the schema output:

Replace the existing schema block:

```typescript
// Handle --schema flag
if (args.schema) {
	const { cliJsonSchema } = yield* Effect.promise(() => import("../schemas/json-schema.js"));
	yield* Console.log(JSON.stringify(cliJsonSchema, null, 2));
	return;
}
```

With:

```typescript
// Handle --schema flag with strict validation
if (args.schema) {
	const resolveFlags = [
		args.node, args.bun, args.deno,
		args.nodePhases, args.increments, args.freshness,
		args.nodeDefault, args.bunDefault, args.denoDefault,
		args.nodeDate,
	];
	const hasResolveFlags = resolveFlags.some((f) => Option.isSome(f));
	if (hasResolveFlags) {
		yield* Console.error("Error: --schema cannot be combined with resolve flags (--node, --bun, --deno, etc.)");
		return;
	}

	const { cliJsonSchema } = yield* Effect.promise(() => import("../schemas/json-schema.js"));
	yield* Console.log(JSON.stringify(cliJsonSchema, null, 2));
	return;
}
```

**Step 3: Add freshness validation and threading**

In the handler, after the increments validation block, add:

```typescript
// Validate and extract freshness
let validatedFreshness: Freshness | undefined;
if (Option.isSome(args.freshness)) {
	try {
		validatedFreshness = validateFreshness(args.freshness.value);
	} catch (e) {
		yield* Console.error((e as Error).message);
		return;
	}
}
```

Update `resolveNode`, `resolveBun`, `resolveDeno` helper functions to accept and pass `freshness`:

```typescript
const resolveBun = (
	semverRange: string,
	increments?: Increments,
	defaultVersion?: string,
	freshness?: Freshness,
): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* BunResolver;
		const result = yield* resolver.resolve({
			semverRange,
			...(increments ? { increments } : {}),
			...(defaultVersion ? { defaultVersion } : {}),
			...(freshness ? { freshness } : {}),
		});
		return toSuccess("bun", result);
	}).pipe(
		Effect.provide(BunLayer),
		Effect.catchAll((error) => Effect.succeed(toError("bun", error))),
	);
```

Same for `resolveDeno`. For `resolveNode`, add `freshness?: Freshness` parameter and pass it through.

Update the call sites in the handler to pass `validatedFreshness`:

```typescript
if (hasNode) {
	const nodeDefaultVersion = Option.isSome(args.nodeDefault) ? args.nodeDefault.value : undefined;
	tasks.push(resolveNode(args.node.value, validatedPhases, validatedIncrements, nodeDefaultVersion, nodeDate, validatedFreshness));
}
if (hasBun) {
	const bunDefaultVersion = Option.isSome(args.bunDefault) ? args.bunDefault.value : undefined;
	tasks.push(resolveBun(args.bun.value, validatedIncrements, bunDefaultVersion, validatedFreshness));
}
if (hasDeno) {
	const denoDefaultVersion = Option.isSome(args.denoDefault) ? args.denoDefault.value : undefined;
	tasks.push(resolveDeno(args.deno.value, validatedIncrements, denoDefaultVersion, validatedFreshness));
}
```

**Step 4: Update handler signature**

Add `freshness` to the handler args type:

```typescript
export const resolveHandler = (args: {
	readonly node: Option.Option<string>;
	readonly bun: Option.Option<string>;
	readonly deno: Option.Option<string>;
	readonly nodePhases: Option.Option<string>;
	readonly increments: Option.Option<string>;
	readonly freshness: Option.Option<string>;
	readonly nodeDefault: Option.Option<string>;
	readonly bunDefault: Option.Option<string>;
	readonly denoDefault: Option.Option<string>;
	readonly nodeDate: Option.Option<string>;
	readonly pretty: boolean;
	readonly schema: boolean;
}) =>
```

**Step 5: Update `src/cli/index.ts`**

Add `freshnessOption` to imports and command definition:

```typescript
import {
	bunDefaultOption,
	bunOption,
	denoDefaultOption,
	denoOption,
	freshnessOption,
	incrementsOption,
	nodeOption,
	nodeDefaultOption,
	nodeDateOption,
	nodePhasesOption,
	prettyOption,
	resolveHandler,
	schemaOption,
} from "./commands/resolve.js";

const rootCommand = Command.make(
	"runtime-resolver",
	{
		node: nodeOption,
		bun: bunOption,
		deno: denoOption,
		nodePhases: nodePhasesOption,
		increments: incrementsOption,
		freshness: freshnessOption,
		nodeDefault: nodeDefaultOption,
		bunDefault: bunDefaultOption,
		denoDefault: denoDefaultOption,
		nodeDate: nodeDateOption,
		pretty: prettyOption,
		schema: schemaOption,
	},
	resolveHandler,
);
```

**Step 6: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

**Step 7: Commit**

```bash
git add src/cli/commands/resolve.ts src/cli/index.ts
git commit -m "feat: add --freshness CLI flag and strict --schema validation

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 7: Update Promise API and exports

**Files:**
- Modify: `src/index.ts`
- Modify: `src/effect.ts`
- Modify: `src/index.test.ts`

**Step 1: Export `Freshness` type from both entry points**

In `src/index.ts`:

```typescript
export type { Freshness, Increments, NodePhase, ResolvedVersions, Source } from "./schemas/common.js";
```

In `src/effect.ts`:

```typescript
export type { Freshness, Increments, NodePhase, ResolvedVersions, Runtime, Source } from "./schemas/common.js";
export { FreshnessError } from "./errors/FreshnessError.js";
```

**Step 2: Update `src/index.test.ts`**

Add a test verifying `freshness: "cache"` works through the Promise API:

```typescript
it("resolveBun accepts freshness option", async () => {
	const result = await resolveBun({ freshness: "cache" });
	expect(result.source).toBe("cache");
	expect(result.versions.length).toBeGreaterThan(0);
});
```

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add src/index.ts src/effect.ts src/index.test.ts
git commit -m "feat: export Freshness type and FreshnessError, add Promise API test

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 8: Update documentation

**Files:**
- Modify: `docs/promise-api.md`
- Modify: `docs/effect-api.md`
- Modify: `docs/cli.md`
- Modify: `docs/error-handling.md`
- Modify: `docs/offline-fallback.md`
- Modify: `README.md`

**Step 1: Update each doc file**

Key changes per file:

- `docs/promise-api.md`: Add `freshness` option to all three runtime option tables. Add example: `resolveBun({ freshness: "cache" })`.
- `docs/effect-api.md`: Add `Freshness` type to schemas section. Add `FreshnessError` to error exports. Add `freshness` to all option interfaces.
- `docs/cli.md`: Add `--freshness auto|api|cache` flag. Document strict `--schema` validation. Add example usage.
- `docs/error-handling.md`: Document `FreshnessError` with description and example.
- `docs/offline-fallback.md`: Add section about using `freshness: "cache"` for explicit offline mode and `freshness: "api"` for CI environments that require fresh data.
- `README.md`: Mention freshness control in the features list.

**Step 2: Run markdown lint**

Run: `pnpm run lint:md`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add docs/ README.md
git commit -m "docs: document freshness control, FreshnessError, and CLI flag validation

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```
