import { Data } from "effect";

/**
 * Raised when a GitHub authentication attempt fails.
 *
 * This error is produced by the {@link GitHubTokenAuth} and
 * {@link GitHubAppAuth} layers when the supplied credentials are rejected by
 * the GitHub API or when required configuration values (e.g. a token or app
 * private key) are missing from the environment.
 *
 * @see {@link GitHubTokenAuth}
 * @see {@link GitHubAppAuth}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { AuthenticationError } from "./AuthenticationError.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program = resolveNode(">=20").pipe(
 *   Effect.catchTag("AuthenticationError", (err: AuthenticationError) =>
 *     Effect.logError(
 *       `Auth failed via ${err.method}: ${err.message}`
 *     ).pipe(Effect.andThen(Effect.fail(err)))
 *   )
 * );
 * ```
 *
 * @public
 */
export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
	readonly method: "token" | "app";
	readonly message: string;
}> {}
