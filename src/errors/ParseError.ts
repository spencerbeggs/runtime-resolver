import { Data } from "effect";

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
export class ParseError extends Data.TaggedError("ParseError")<{
	readonly source: string;
	readonly message: string;
}> {}
