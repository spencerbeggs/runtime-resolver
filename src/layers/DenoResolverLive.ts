import { Effect, Layer, Schedule } from "effect";
import * as semver from "semver";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { resolveVersionFromList } from "../lib/semver-utils.js";
import { normalizeDenoTag } from "../lib/tag-normalizers.js";
import type { CachedTagData } from "../schemas/cache.js";
import type { ResolvedVersions } from "../schemas/common.js";
import type { GitHubTag } from "../schemas/github.js";
import type { DenoResolverOptions } from "../services/DenoResolver.js";
import { DenoResolver } from "../services/DenoResolver.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { VersionCache } from "../services/VersionCache.js";

const tagsToVersions = (tags: ReadonlyArray<GitHubTag>): string[] => {
	const versions: string[] = [];
	for (const tag of tags) {
		const normalized = normalizeDenoTag(tag.name);
		if (normalized) {
			versions.push(normalized);
		}
	}
	return semver.rsort(versions);
};

const retryOnRateLimit = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	effect.pipe(
		Effect.retry({
			schedule: Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))),
			while: (error) => (error as { _tag?: string })._tag === "RateLimitError",
		}),
	);

export const DenoResolverLive: Layer.Layer<DenoResolver, never, GitHubClient | VersionCache> = Layer.effect(
	DenoResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchDenoTags = () =>
			retryOnRateLimit(client.listTags("denoland", "deno", { perPage: 100 })).pipe(
				Effect.tap((tags) => cache.set("deno", { tags: tags as GitHubTag[] })),
			);

		const fetchWithCacheFallback = () =>
			fetchDenoTags().pipe(
				Effect.catchTag("NetworkError", () =>
					Effect.gen(function* () {
						const cached = yield* cache.get("deno");
						return (cached as CachedTagData).tags;
					}),
				),
			);

		return {
			resolve: (options?: DenoResolverOptions) =>
				Effect.gen(function* () {
					const tags = yield* fetchWithCacheFallback();
					const allVersions = tagsToVersions(tags);

					if (allVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "deno",
								constraint: options?.semverRange ?? "*",
								message: "No valid Deno versions found",
							}),
						);
					}

					let versions: string[];
					if (options?.semverRange) {
						versions = allVersions.filter((v) => semver.satisfies(v, options.semverRange!));
					} else {
						versions = allVersions;
					}

					if (versions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "deno",
								constraint: options?.semverRange ?? "*",
								message: `No Deno versions found matching "${options?.semverRange}"`,
							}),
						);
					}

					let resolvedDefault: string | undefined;
					if (options?.defaultVersion) {
						resolvedDefault = resolveVersionFromList(options.defaultVersion, allVersions);

						if (resolvedDefault && !versions.includes(resolvedDefault)) {
							versions = [...versions, resolvedDefault];
							versions = semver.rsort(versions);
						}
					}

					const latest = allVersions[0];

					return {
						versions,
						latest,
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					} satisfies ResolvedVersions;
				}),
		};
	}),
);
