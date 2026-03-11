import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link RateLimitError} to a stable declaration.
 * Without it the bundled `.d.ts` would contain an anonymous `_base` symbol
 * that cannot be referenced by downstream consumers.
 */
export const RateLimitErrorBase = Data.TaggedError("RateLimitError");

/**
 * Raised when a GitHub API rate limit is exceeded.
 *
 * The `limit` and `remaining` fields reflect the values returned in the
 * `X-RateLimit-Limit` and `X-RateLimit-Remaining` response headers. When the
 * API indicates how long to wait before the quota resets, that duration (in
 * seconds) is available via `retryAfter`.
 *
 * Use {@link retryOnRateLimit} to automatically retry an effect with
 * exponential backoff whenever this error is encountered.
 *
 * @see {@link retryOnRateLimit}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { RateLimitError } from "./RateLimitError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("RateLimitError", (err: RateLimitError) =>
 *     Effect.logWarning(
 *       `Rate limit hit (${err.remaining}/${err.limit} remaining)` +
 *       (err.retryAfter != null ? `, retry after ${err.retryAfter}s` : "") +
 *       `: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class RateLimitError extends RateLimitErrorBase<{
	readonly retryAfter?: number;
	readonly limit: number;
	readonly remaining: number;
	readonly message: string;
}> {}
