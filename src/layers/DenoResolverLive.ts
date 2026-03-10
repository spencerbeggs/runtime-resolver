import { Effect, Layer } from "effect";
import * as semver from "semver";
import { InvalidInputError } from "../errors/InvalidInputError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { retryOnRateLimit } from "../lib/retry.js";
import { filterByIncrements, resolveVersionFromList } from "../lib/semver-utils.js";
import { normalizeDenoTag } from "../lib/tag-normalizers.js";
import type { CachedTagData } from "../schemas/cache.js";
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

export const DenoResolverLive: Layer.Layer<DenoResolver, never, GitHubClient | VersionCache> = Layer.effect(
	DenoResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchDenoTags = () =>
			retryOnRateLimit(client.listTags("denoland", "deno", { perPage: 100 })).pipe(
				Effect.tap((tags) => cache.set("deno", { tags: tags as GitHubTag[] })),
				Effect.map((tags) => ({ tags, source: "api" as const })),
				Effect.catchTag("NetworkError", () =>
					Effect.gen(function* () {
						const { data: cached, source } = yield* cache.get("deno");
						return { tags: (cached as CachedTagData).tags, source };
					}),
				),
				Effect.catchTag("CacheError", () =>
					Effect.succeed({ tags: [] as ReadonlyArray<GitHubTag>, source: "cache" as const }),
				),
			);

		return {
			resolve: (options?: DenoResolverOptions) =>
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

					const { tags, source } = yield* fetchDenoTags();
					const allVersions = tagsToVersions(tags);

					if (allVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "deno",
								constraint: semverRange,
								message: "No valid Deno versions found",
							}),
						);
					}

					let versions = allVersions.filter((v) => semver.satisfies(v, semverRange));

					if (versions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "deno",
								constraint: semverRange,
								message: `No Deno versions found matching "${semverRange}"`,
							}),
						);
					}

					const increments = options?.increments ?? "patch";
					versions = filterByIncrements(versions, increments);
					versions = semver.rsort(versions);

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
