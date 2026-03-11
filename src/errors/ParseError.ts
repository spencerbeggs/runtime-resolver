import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link ParseError} to a stable declaration.
 * Without it the bundled `.d.ts` would contain an anonymous `_base` symbol
 * that cannot be referenced by downstream consumers.
 */
export const ParseErrorBase = Data.TaggedError("ParseError");

/**
 * Raised when the body of an upstream API response cannot be decoded.
 *
 * This error is produced after a successful HTTP response is received but
 * its payload does not match the expected shape — for example, when a release
 * index returns malformed JSON or when a required field is missing from the
 * response structure. The `source` field identifies the URL or data source
 * that produced the unparseable content.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { ParseError } from "./ParseError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("ParseError", (err: ParseError) =>
 *     Effect.logError(
 *       `Failed to parse response from ${err.source}: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class ParseError extends ParseErrorBase<{
	readonly source: string;
	readonly message: string;
}> {}
