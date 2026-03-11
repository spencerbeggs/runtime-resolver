import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link CacheError} to a stable declaration.
 * Without it the bundled `.d.ts` would contain an anonymous `_base` symbol
 * that cannot be referenced by downstream consumers.
 */
export const CacheErrorBase = Data.TaggedError("CacheError");

/**
 * Raised when a cache read or write operation fails.
 *
 * This error surfaces when the local on-disk version cache cannot be accessed
 * or updated. The `operation` field distinguishes between failures that occur
 * while loading cached data (`"read"`) and failures that occur while
 * persisting new data (`"write"`).
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { CacheError } from "./CacheError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("CacheError", (err: CacheError) =>
 *     Effect.logWarning(
 *       `Cache ${err.operation} failed: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class CacheError extends CacheErrorBase<{
	readonly operation: "read" | "write";
	readonly message: string;
}> {}
