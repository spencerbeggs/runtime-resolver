import { Data } from "effect";

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
export class FreshnessError extends Data.TaggedError("FreshnessError")<{
	readonly strategy: "auto" | "api" | "cache";
	readonly message: string;
}> {}
