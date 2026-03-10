import type { Effect } from "effect";
import { Context } from "effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { GitHubRelease, GitHubTag } from "../schemas/github.js";

export interface ListOptions {
	readonly perPage?: number;
	readonly pages?: number;
}

/**
 * Service interface for GitHub API operations.
 */
export interface GitHubClient {
	readonly listTags: (
		owner: string,
		repo: string,
		options?: ListOptions,
	) => Effect.Effect<ReadonlyArray<GitHubTag>, AuthenticationError | NetworkError | RateLimitError | ParseError>;

	readonly listReleases: (
		owner: string,
		repo: string,
		options?: ListOptions,
	) => Effect.Effect<ReadonlyArray<GitHubRelease>, AuthenticationError | NetworkError | RateLimitError | ParseError>;

	readonly getJson: <A>(
		url: string,
		schema: {
			readonly decode: (input: unknown) => Effect.Effect<A, ParseError>;
		},
	) => Effect.Effect<A, NetworkError | ParseError>;
}

/** @deprecated Use {@link GitHubClient} instead. */
export type GitHubClientShape = GitHubClient;

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const GitHubClient = Context.GenericTag<GitHubClient>("GitHubClient");
