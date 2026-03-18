import { Context } from "effect";

/**
 * Thin wrapper around the subset of Octokit's REST client used by
 * {@link GitHubClient}.
 *
 * Exposing only the repository methods actually consumed by this library
 * keeps the surface area narrow and makes the interface straightforward to
 * stub in tests without pulling in the full Octokit type.
 *
 * An `OctokitInstance` is provided to the dependency graph by one of the
 * three authentication layers: {@link GitHubTokenAuth}, {@link GitHubAppAuth},
 * or {@link GitHubAutoAuth}.
 *
 * @example
 * ```typescript
 * import { OctokitInstance, GitHubClientLive, GitHubAutoAuth } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const octokit = yield* OctokitInstance;
 * 	const response = await octokit.rest.repos.listTags({
 * 		owner: "oven-sh",
 * 		repo: "bun",
 * 		per_page: 10,
 * 	});
 * 	console.log(response.data.length);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(GitHubAutoAuth)));
 * ```
 *
 * @see {@link GitHubClientLive}
 * @see {@link GitHubTokenAuth}
 * @see {@link GitHubAppAuth}
 * @see {@link GitHubAutoAuth}
 *
 * @public
 */
export class OctokitInstance extends Context.Tag("runtime-resolver/OctokitInstance")<
	OctokitInstance,
	{
		readonly rest: {
			readonly repos: {
				/**
				 * Lists git tags for a repository, corresponding to
				 * `GET /repos/{owner}/{repo}/tags`.
				 *
				 * @param params - Owner, repo, and optional pagination parameters.
				 */
				readonly listTags: (params: {
					owner: string;
					repo: string;
					per_page?: number;
					page?: number;
				}) => Promise<{ data: Array<unknown> }>;

				/**
				 * Lists GitHub Releases for a repository, corresponding to
				 * `GET /repos/{owner}/{repo}/releases`.
				 *
				 * @param params - Owner, repo, and optional pagination parameters.
				 */
				readonly listReleases: (params: {
					owner: string;
					repo: string;
					per_page?: number;
					page?: number;
				}) => Promise<{ data: Array<unknown> }>;
			};
		};
	}
>() {}
