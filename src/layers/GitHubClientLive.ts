import { Effect, Layer, Schema } from "effect";
import { NetworkError } from "../errors/NetworkError.js";
import { ParseError } from "../errors/ParseError.js";
import { RateLimitError } from "../errors/RateLimitError.js";
import { GitHubReleaseList, GitHubTagList } from "../schemas/github.js";
import type { ListOptions } from "../services/GitHubClient.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { OctokitInstance } from "../services/OctokitInstance.js";

const mapOctokitError = (error: unknown, url: string): NetworkError | RateLimitError => {
	const err = error as { status?: number; response?: { headers?: Record<string, string> } };

	if (err.status === 403 || err.status === 429) {
		const headers = err.response?.headers ?? {};
		const retryAfterStr = headers["retry-after"];
		return new RateLimitError({
			...(retryAfterStr ? { retryAfter: Number.parseInt(retryAfterStr, 10) } : {}),
			limit: headers["x-ratelimit-limit"] ? Number.parseInt(headers["x-ratelimit-limit"], 10) : 0,
			remaining: headers["x-ratelimit-remaining"] ? Number.parseInt(headers["x-ratelimit-remaining"], 10) : 0,
			message: `GitHub API rate limit exceeded for ${url}`,
		});
	}

	return new NetworkError({
		url,
		...(err.status !== undefined ? { status: err.status } : {}),
		message: error instanceof Error ? error.message : String(error),
	});
};

const decodeTagList = Schema.decodeUnknown(GitHubTagList);
const decodeReleaseList = Schema.decodeUnknown(GitHubReleaseList);

export const GitHubClientLive: Layer.Layer<GitHubClient, never, OctokitInstance> = Layer.effect(
	GitHubClient,
	Effect.gen(function* () {
		const octokit = yield* OctokitInstance;

		return {
			listTags: (owner, repo, options?: ListOptions) =>
				Effect.gen(function* () {
					const perPage = options?.perPage ?? 100;
					const maxPages = options?.pages ?? 1;
					const allTags: Array<(typeof GitHubTagList.Type)[number]> = [];

					for (let page = 1; page <= maxPages; page++) {
						const response = yield* Effect.tryPromise({
							try: () =>
								octokit.rest.repos.listTags({
									owner,
									repo,
									per_page: perPage,
									page,
								}),
							catch: (error) => mapOctokitError(error, `repos/${owner}/${repo}/tags`),
						});

						const tags = yield* decodeTagList(response.data).pipe(
							Effect.mapError(
								(e) =>
									new ParseError({
										source: `repos/${owner}/${repo}/tags`,
										message: `Schema validation failed: ${e.message}`,
									}),
							),
						);

						allTags.push(...tags);

						if (response.data.length < perPage) break;
					}

					return allTags;
				}),

			listReleases: (owner, repo, options?: ListOptions) =>
				Effect.gen(function* () {
					const perPage = options?.perPage ?? 100;
					const maxPages = options?.pages ?? 1;
					const allReleases: Array<(typeof GitHubReleaseList.Type)[number]> = [];

					for (let page = 1; page <= maxPages; page++) {
						const response = yield* Effect.tryPromise({
							try: () =>
								octokit.rest.repos.listReleases({
									owner,
									repo,
									per_page: perPage,
									page,
								}),
							catch: (error) => mapOctokitError(error, `repos/${owner}/${repo}/releases`),
						});

						const releases = yield* decodeReleaseList(response.data).pipe(
							Effect.mapError(
								(e) =>
									new ParseError({
										source: `repos/${owner}/${repo}/releases`,
										message: `Schema validation failed: ${e.message}`,
									}),
							),
						);

						allReleases.push(...releases);

						if (response.data.length < perPage) break;
					}

					return allReleases;
				}),

			getJson: <A>(url: string, schema: { readonly decode: (input: unknown) => Effect.Effect<A, ParseError> }) =>
				Effect.gen(function* () {
					const response = yield* Effect.tryPromise({
						try: () => fetch(url),
						catch: (error) =>
							new NetworkError({
								url,
								message: error instanceof Error ? error.message : String(error),
							}),
					});

					if (!response.ok) {
						yield* Effect.fail(
							new NetworkError({
								url,
								status: response.status,
								message: `HTTP ${response.status}: ${response.statusText}`,
							}),
						);
					}

					const json = yield* Effect.tryPromise({
						try: () => response.json(),
						catch: () =>
							new ParseError({
								source: url,
								message: "Failed to parse JSON response",
							}),
					});

					return yield* schema.decode(json);
				}),
		};
	}),
);
