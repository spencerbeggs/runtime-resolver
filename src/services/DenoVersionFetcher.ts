import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";

/**
 * Service interface for fetching Deno release data from the GitHub API.
 *
 * Retrieves both the parsed semver version list and the raw release input
 * records needed to populate a {@link DenoReleaseCache}. The live
 * implementation queries the `denoland/deno` GitHub repository via
 * {@link GitHubClient}.
 *
 * @see {@link DenoVersionFetcherLive}
 * @see {@link DenoReleaseCache}
 * @see {@link AuthenticationError}
 * @see {@link NetworkError}
 * @see {@link ParseError}
 * @see {@link RateLimitError}
 *
 * @public
 */
export interface DenoVersionFetcher {
	/**
	 * Fetches all available Deno releases from the GitHub API and returns both
	 * the parsed semver version objects and the raw release input records.
	 *
	 * Fails with:
	 * - {@link AuthenticationError} — missing or invalid GitHub credentials.
	 * - {@link NetworkError} — the upstream request could not be completed.
	 * - {@link ParseError} — the response payload could not be decoded.
	 * - {@link RateLimitError} — the GitHub API rate limit was exceeded.
	 */
	readonly fetch: () => Effect.Effect<
		{
			readonly versions: ReadonlyArray<SemVer.SemVer>;
			readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
		},
		AuthenticationError | NetworkError | ParseError | RateLimitError
	>;
}

/**
 * Service tag and companion object for {@link DenoVersionFetcher}.
 *
 * Acts as both the TypeScript service interface and the Effect dependency tag
 * used for dependency injection (companion object pattern). Yield this tag
 * inside `Effect.gen` to access the fetcher implementation provided by
 * {@link DenoVersionFetcherLive}.
 *
 * @example
 * ```typescript
 * import type { RuntimeReleaseInput } from "runtime-resolver";
 * import { DenoVersionFetcher, DenoVersionFetcherLive, GitHubAutoAuth } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const fetcher = yield* DenoVersionFetcher;
 * 	const { versions, inputs } = yield* fetcher.fetch();
 * 	console.log(`Fetched ${versions.length} Deno releases`);
 * });
 *
 * Effect.runPromise(
 * 	program.pipe(Effect.provide(DenoVersionFetcherLive), Effect.provide(GitHubAutoAuth)),
 * );
 * ```
 *
 * @see {@link DenoVersionFetcherLive}
 *
 * @public
 */
export const DenoVersionFetcher = Context.GenericTag<DenoVersionFetcher>("DenoVersionFetcher");
