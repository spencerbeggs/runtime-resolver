import { Data } from "effect";

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
export class CacheError extends Data.TaggedError("CacheError")<{
	readonly operation: "read" | "write";
	readonly message: string;
}> {}
