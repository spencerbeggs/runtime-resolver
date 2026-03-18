import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";

/**
 * Service for fetching Bun release data from the GitHub API.
 *
 * Retrieves both the parsed semver version list and the raw release input
 * records needed to populate a {@link BunReleaseCache}. The live
 * implementation queries the `oven-sh/bun` GitHub repository via
 * {@link GitHubClient}.
 *
 * @example
 * ```typescript
 * import type { RuntimeReleaseInput } from "runtime-resolver";
 * import { BunVersionFetcher, BunVersionFetcherLive, GitHubAutoAuth } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const fetcher = yield* BunVersionFetcher;
 * 	const { versions, inputs } = yield* fetcher.fetch();
 * 	console.log(`Fetched ${versions.length} Bun releases`);
 * });
 *
 * Effect.runPromise(
 * 	program.pipe(Effect.provide(BunVersionFetcherLive), Effect.provide(GitHubAutoAuth)),
 * );
 * ```
 *
 * @see {@link BunVersionFetcherLive}
 * @see {@link BunReleaseCache}
 * @see {@link AuthenticationError}
 * @see {@link NetworkError}
 * @see {@link ParseError}
 * @see {@link RateLimitError}
 *
 * @public
 */
export class BunVersionFetcher extends Context.Tag("runtime-resolver/BunVersionFetcher")<
	BunVersionFetcher,
	{
		/**
		 * Fetches all available Bun releases from the GitHub API and returns both
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
				readonly versions: ReadonlyArray<SemVer>;
				readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
			},
			AuthenticationError | NetworkError | ParseError | RateLimitError
		>;
	}
>() {}
