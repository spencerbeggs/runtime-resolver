import { Effect, Layer } from "effect";
import * as semver from "semver";
import { InvalidInputError } from "../errors/InvalidInputError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { retryOnRateLimit } from "../lib/retry.js";
import { resolveVersionFromList } from "../lib/semver-utils.js";
import { normalizeBunTag } from "../lib/tag-normalizers.js";
import type { CachedTagData } from "../schemas/cache.js";
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

export const BunResolverLive: Layer.Layer<BunResolver, never, GitHubClient | VersionCache> = Layer.effect(
	BunResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchBunTags = () =>
			retryOnRateLimit(client.listTags("oven-sh", "bun", { perPage: 100 })).pipe(
				Effect.tap((tags) => cache.set("bun", { tags: tags as GitHubTag[] })),
				Effect.map((tags) => ({ tags, source: "api" as const })),
				Effect.catchTag("NetworkError", () =>
					Effect.gen(function* () {
						const { data: cached, source } = yield* cache.get("bun");
						return { tags: (cached as CachedTagData).tags, source };
					}),
				),
				Effect.catchTag("CacheError", () =>
					Effect.succeed({ tags: [] as ReadonlyArray<GitHubTag>, source: "cache" as const }),
				),
			);

		return {
			resolve: (options?: BunResolverOptions) =>
				Effect.gen(function* () {
					const semverRange = options?.semverRange ?? "*";
					if (!semver.validRange(semverRange)) {
						return yield* Effect.fail(
							new InvalidInputError({
								field: "semverRange",
								value: semverRange,
								message: `Invalid semver range: "${semverRange}"`,
							}),
						);
					}

					const { tags, source } = yield* fetchBunTags();
					const allVersions = tagsToVersions(tags);

					if (allVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: semverRange,
								message: "No valid Bun versions found",
							}),
						);
					}

					let versions = allVersions.filter((v) => semver.satisfies(v, semverRange));

					if (versions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: semverRange,
								message: `No Bun versions found matching "${semverRange}"`,
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
						source,
						versions,
						latest,
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					};
				}),
		};
	}),
);
