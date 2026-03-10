import { Effect, Layer, Schedule } from "effect";
import * as semver from "semver";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { resolveVersionFromList } from "../lib/semver-utils.js";
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
					const { tags, source } = yield* fetchDenoTags();
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
					const semverRange = options?.semverRange;
					if (semverRange) {
						versions = allVersions.filter((v) => semver.satisfies(v, semverRange));
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
						source,
						versions,
						latest,
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					};
				}),
		};
	}),
);
