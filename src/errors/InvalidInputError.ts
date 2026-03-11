import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link InvalidInputError} to a stable
 * declaration. Without it the bundled `.d.ts` would contain an anonymous
 * `_base` symbol that cannot be referenced by downstream consumers.
 */
export const InvalidInputErrorBase = Data.TaggedError("InvalidInputError");

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
export class InvalidInputError extends InvalidInputErrorBase<{
	readonly field: string;
	readonly value: string;
	readonly message: string;
}> {}
