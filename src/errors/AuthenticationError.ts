import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling (api-extractor). When `export *` re-exports
 * a class whose `extends` expression is an inline call like
 * `Data.TaggedError(...)`, TypeScript emits an un-nameable `_base` symbol in
 * the declaration file. Splitting the base into a named export gives the
 * bundler a stable reference.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link AuthenticationError} to a stable
 * declaration. Without it the bundled `.d.ts` would contain an anonymous
 * `_base` symbol that cannot be referenced by downstream consumers.
 */
export const AuthenticationErrorBase = Data.TaggedError("AuthenticationError");

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
export class AuthenticationError extends AuthenticationErrorBase<{
	readonly method: "token" | "app";
	readonly message: string;
}> {}
