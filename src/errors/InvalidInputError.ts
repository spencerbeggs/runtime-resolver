import { Data } from "effect";

/**
 * Raised when a caller-supplied value fails validation.
 *
 * This error is produced at the boundary where user-provided inputs (such as
 * version constraint strings or runtime identifiers) are decoded against their
 * expected schemas. The `field` identifies which input was invalid, `value`
 * carries the raw string that was rejected, and `message` explains the
 * specific violation.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { InvalidInputError } from "./InvalidInputError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode("not-a-semver-range").pipe(
 *   Effect.catchTag("InvalidInputError", (err: InvalidInputError) =>
 *     Effect.logError(
 *       `Invalid value for "${err.field}": ${err.value} — ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
	readonly field: string;
	readonly value: string;
	readonly message: string;
}> {}
