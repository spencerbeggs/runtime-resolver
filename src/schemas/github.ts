import { Schema } from "effect";

/**
 * The `commit` sub-object returned for each entry in the GitHub tags API.
 *
 * Used as a nested field within {@link GitHubTag}.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export const GitHubTagCommit = Schema.Struct({
	sha: Schema.String,
	url: Schema.String,
});

/**
 * A single tag entry as returned by the GitHub REST API
 * (`GET /repos/{owner}/{repo}/tags`).
 *
 * Consumed by {@link GitHubClient} when fetching Bun and Deno release tags.
 *
 * @see {@link GitHubClient}
 * @see {@link GitHubTagList}
 *
 * @public
 */
export const GitHubTag = Schema.Struct({
	name: Schema.String,
	zipball_url: Schema.String,
	tarball_url: Schema.String,
	commit: GitHubTagCommit,
	node_id: Schema.String,
});

/**
 * A single tag entry as returned by the GitHub REST API.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export type GitHubTag = typeof GitHubTag.Type;

/**
 * The decoded response body from `GET /repos/{owner}/{repo}/tags`.
 *
 * @see {@link GitHubClient}
 * @see {@link GitHubTag}
 *
 * @public
 */
export const GitHubTagList = Schema.Array(GitHubTag);

/**
 * The decoded response body from `GET /repos/{owner}/{repo}/tags`.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export type GitHubTagList = typeof GitHubTagList.Type;

/**
 * A single release entry as returned by the GitHub REST API
 * (`GET /repos/{owner}/{repo}/releases`).
 *
 * Consumed by {@link GitHubClient} when fetching Deno releases that carry
 * publication timestamps.
 *
 * @see {@link GitHubClient}
 * @see {@link GitHubReleaseList}
 *
 * @public
 */
export const GitHubRelease = Schema.Struct({
	tag_name: Schema.String,
	name: Schema.NullOr(Schema.String),
	draft: Schema.Boolean,
	prerelease: Schema.Boolean,
	published_at: Schema.NullOr(Schema.String),
});

/**
 * A single release entry as returned by the GitHub REST API.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export type GitHubRelease = typeof GitHubRelease.Type;

/**
 * The decoded response body from `GET /repos/{owner}/{repo}/releases`.
 *
 * @see {@link GitHubClient}
 * @see {@link GitHubRelease}
 *
 * @public
 */
export const GitHubReleaseList = Schema.Array(GitHubRelease);

/**
 * The decoded response body from `GET /repos/{owner}/{repo}/releases`.
 *
 * @see {@link GitHubClient}
 *
 * @public
 */
export type GitHubReleaseList = typeof GitHubReleaseList.Type;
