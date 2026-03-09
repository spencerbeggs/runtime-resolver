import { Schema } from "effect";

export const GitHubTagCommit = Schema.Struct({
	sha: Schema.String,
	url: Schema.String,
});

export const GitHubTag = Schema.Struct({
	name: Schema.String,
	zipball_url: Schema.String,
	tarball_url: Schema.String,
	commit: GitHubTagCommit,
	node_id: Schema.String,
});
export type GitHubTag = typeof GitHubTag.Type;

export const GitHubTagList = Schema.Array(GitHubTag);
export type GitHubTagList = typeof GitHubTagList.Type;

export const GitHubRelease = Schema.Struct({
	tag_name: Schema.String,
	name: Schema.NullOr(Schema.String),
	draft: Schema.Boolean,
	prerelease: Schema.Boolean,
	published_at: Schema.NullOr(Schema.String),
});
export type GitHubRelease = typeof GitHubRelease.Type;

export const GitHubReleaseList = Schema.Array(GitHubRelease);
export type GitHubReleaseList = typeof GitHubReleaseList.Type;
