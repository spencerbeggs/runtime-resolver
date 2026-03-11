import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link FreshnessError} to a stable declaration.
 * Without it the bundled `.d.ts` would contain an anonymous `_base` symbol
 * that cannot be referenced by downstream consumers.
 */
export const FreshnessErrorBase = Data.TaggedError("FreshnessError");

/**
 * Raised when a cache freshness check cannot be completed.
 *
 * Each runtime cache layer ({@link FreshBunCacheLive}, {@link FreshDenoCacheLive},
 * {@link FreshNodeCacheLive}) validates whether locally stored version data is
 * still current before returning it. This error is produced when that
 * validation fails — for example, when the upstream API is unreachable during
 * an `"api"` freshness check, or when the cached timestamp is corrupt during
 * an `"auto"` or `"cache"` check.
 *
 * @see {@link FreshBunCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @see {@link FreshNodeCacheLive}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { FreshnessError } from "./FreshnessError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("FreshnessError", (err: FreshnessError) =>
 *     Effect.logWarning(
 *       `Freshness check (${err.strategy}) failed: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class FreshnessError extends FreshnessErrorBase<{
	readonly strategy: "auto" | "api" | "cache";
	readonly message: string;
}> {}
