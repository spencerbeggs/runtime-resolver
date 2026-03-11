import { Data } from "effect";
import type { Runtime } from "../schemas/common.js";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link VersionNotFoundError} to a stable
 * declaration. Without it the bundled `.d.ts` would contain an anonymous
 * `_base` symbol that cannot be referenced by downstream consumers.
 */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

/**
 * Raised when no published version satisfies the requested constraint.
 *
 * This error is produced by {@link NodeResolver}, {@link BunResolver}, and
 * {@link DenoResolver} after the full list of available versions has been
 * fetched and filtered but no entry matches the caller-supplied semver
 * constraint. The `runtime` field identifies which runtime was queried and
 * `constraint` echoes the range string that was provided.
 *
 * @see {@link NodeResolver}
 * @see {@link BunResolver}
 * @see {@link DenoResolver}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { VersionNotFoundError } from "./VersionNotFoundError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=999").pipe(
 *   Effect.catchTag("VersionNotFoundError", (err: VersionNotFoundError) =>
 *     Effect.logError(
 *       `No ${err.runtime} version matched "${err.constraint}": ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	readonly runtime: Runtime;
	readonly constraint: string;
	readonly message: string;
}> {}
