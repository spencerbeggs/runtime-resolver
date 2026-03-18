import type { Effect } from "effect";
import { Context } from "effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { GitHubRelease, GitHubTag } from "../schemas/github.js";

/**
 * Pagination options shared by all list operations on {@link GitHubClient}.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export interface ListOptions {
	/**
	 * Number of items to request per page. Defaults to the GitHub API maximum
	 * of `100` when omitted.
	 */
	readonly perPage?: number;

	/**
	 * Maximum number of pages to fetch. When omitted all pages are fetched
	 * until the API returns an empty result set.
	 */
	readonly pages?: number;
}

/**
 * Service for GitHub REST API operations used by the version
 * fetcher services.
 *
 * Abstracts over pagination and authentication so that higher-level services
 * such as {@link BunVersionFetcher}, {@link DenoVersionFetcher}, and
 * {@link NodeScheduleFetcher} remain independent of the underlying HTTP
 * transport. The live implementation is provided by {@link GitHubClientLive}
 * and requires an {@link OctokitInstance} in its dependency graph.
 *
 * @example
 * ```typescript
 * import type { GitHubTag } from "runtime-resolver";
 * import { GitHubClient, GitHubClientLive, GitHubAutoAuth } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const client = yield* GitHubClient;
 * 	const tags = yield* client.listTags("oven-sh", "bun", { perPage: 100 });
 * 	console.log(`Found ${tags.length} tags`);
 * });
 *
 * Effect.runPromise(
 * 	program.pipe(Effect.provide(GitHubClientLive), Effect.provide(GitHubAutoAuth)),
 * );
 * ```
 *
 * @see {@link GitHubClientLive}
 * @see {@link OctokitInstance}
 * @see {@link ListOptions}
 *
 * @public
 */
export class GitHubClient extends Context.Tag("runtime-resolver/GitHubClient")<
	GitHubClient,
	{
		/**
		 * Lists all git tags for the given repository, automatically paginating
		 * through results according to `options`.
		 *
		 * Fails with:
		 * - {@link AuthenticationError} — missing or invalid GitHub credentials.
		 * - {@link NetworkError} — the upstream request could not be completed.
		 * - {@link RateLimitError} — the GitHub API rate limit was exceeded.
		 * - {@link ParseError} — a response page could not be decoded.
		 *
		 * @param owner - GitHub organisation or user name (e.g. `"oven-sh"`).
		 * @param repo - Repository name (e.g. `"bun"`).
		 * @param options - Optional pagination controls.
		 */
		readonly listTags: (
			owner: string,
			repo: string,
			options?: ListOptions,
		) => Effect.Effect<ReadonlyArray<GitHubTag>, AuthenticationError | NetworkError | RateLimitError | ParseError>;

		/**
		 * Lists all GitHub Releases for the given repository, automatically
		 * paginating through results according to `options`.
		 *
		 * Fails with:
		 * - {@link AuthenticationError} — missing or invalid GitHub credentials.
		 * - {@link NetworkError} — the upstream request could not be completed.
		 * - {@link RateLimitError} — the GitHub API rate limit was exceeded.
		 * - {@link ParseError} — a response page could not be decoded.
		 *
		 * @param owner - GitHub organisation or user name (e.g. `"denoland"`).
		 * @param repo - Repository name (e.g. `"deno"`).
		 * @param options - Optional pagination controls.
		 */
		readonly listReleases: (
			owner: string,
			repo: string,
			options?: ListOptions,
		) => Effect.Effect<ReadonlyArray<GitHubRelease>, AuthenticationError | NetworkError | RateLimitError | ParseError>;

		/**
		 * Fetches arbitrary JSON from `url` and decodes it with the provided
		 * schema, returning the typed result.
		 *
		 * Useful for endpoints outside the standard Octokit REST methods (e.g.
		 * raw GitHub content URLs).
		 *
		 * Fails with:
		 * - {@link NetworkError} — the upstream request could not be completed.
		 * - {@link ParseError} — the response body could not be decoded by `schema`.
		 *
		 * @typeParam A - The decoded output type produced by `schema`.
		 * @param url - Fully qualified URL to fetch.
		 * @param schema - An object with a `decode` method compatible with
		 * Effect Schema's `decodeUnknown`.
		 */
		readonly getJson: <A>(
			url: string,
			schema: {
				readonly decode: (input: unknown) => Effect.Effect<A, ParseError>;
			},
		) => Effect.Effect<A, NetworkError | ParseError>;
	}
>() {}
