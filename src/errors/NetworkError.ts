import { Data } from "effect";

/**
 * Raised when an HTTP request to an upstream API fails.
 *
 * This error is produced when a fetch to a runtime release API (e.g. the
 * Node.js release index, the Deno release feed, or the Bun GitHub releases
 * endpoint) either does not receive a response or receives a non-successful
 * HTTP status code. When a status code is available it is included in the
 * `status` field; for connection-level failures (timeouts, DNS errors) that
 * field is absent.
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { NetworkError } from "./NetworkError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("NetworkError", (err: NetworkError) =>
 *     Effect.logError(
 *       `Request to ${err.url} failed${err.status != null ? ` with status ${err.status}` : ""}: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
	readonly url: string;
	readonly status?: number;
	readonly message: string;
}> {}
