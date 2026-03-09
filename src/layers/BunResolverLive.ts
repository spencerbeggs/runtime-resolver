import { Effect, Layer, Schedule } from "effect";
import * as semver from "semver";
import type { RateLimitError } from "../errors/RateLimitError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { resolveVersionFromList } from "../lib/semver-utils.js";
import { normalizeBunTag } from "../lib/tag-normalizers.js";
import type { CachedTagData } from "../schemas/cache.js";
import type { ResolvedVersions } from "../schemas/common.js";
import type { GitHubTag } from "../schemas/github.js";
import type { BunResolverOptions } from "../services/BunResolver.js";
import { BunResolver } from "../services/BunResolver.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { VersionCache } from "../services/VersionCache.js";

const tagsToVersions = (tags: ReadonlyArray<GitHubTag>): string[] => {
	const versions: string[] = [];
	for (const tag of tags) {
		const normalized = normalizeBunTag(tag.name);
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

export const BunResolverLive: Layer.Layer<BunResolver, never, GitHubClient | VersionCache> = Layer.effect(
	BunResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchBunTags = () =>
			retryOnRateLimit(client.listTags("oven-sh", "bun", { perPage: 100 })).pipe(
				Effect.tap((tags) => cache.set("bun", { tags: tags as GitHubTag[] })),
			);

		const fetchWithCacheFallback = () =>
			fetchBunTags().pipe(
				Effect.catchTag("NetworkError", () =>
					Effect.gen(function* () {
						const cached = yield* cache.get("bun");
						return (cached as CachedTagData).tags;
					}),
				),
			);

		return {
			resolve: (options?: BunResolverOptions) =>
				Effect.gen(function* () {
					const tags = yield* fetchWithCacheFallback();
					const allVersions = tagsToVersions(tags);

					if (allVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: options?.semverRange ?? "*",
								message: "No valid Bun versions found",
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
								runtime: "bun",
								constraint: options?.semverRange ?? "*",
								message: `No Bun versions found matching "${options?.semverRange}"`,
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
