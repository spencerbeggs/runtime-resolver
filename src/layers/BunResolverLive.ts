import { Effect, Layer, Option } from "effect";
import { Range, SemVer } from "semver-effect";
import { FreshnessError } from "../errors/FreshnessError.js";
import { InvalidInputError } from "../errors/InvalidInputError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { retryOnRateLimit } from "../lib/retry.js";
import { filterByIncrements, resolveVersionFromList } from "../lib/semver-utils.js";
import { normalizeBunTag } from "../lib/tag-normalizers.js";
import type { CachedTagData } from "../schemas/cache.js";
import type { Freshness } from "../schemas/common.js";
import type { GitHubTag } from "../schemas/github.js";
import type { BunResolverOptions } from "../services/BunResolver.js";
import { BunResolver } from "../services/BunResolver.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { VersionCache } from "../services/VersionCache.js";

function tryParseSemVer(input: string): Option.Option<SemVer.SemVer> {
	return Effect.runSync(
		SemVer.fromString(input).pipe(
			Effect.map(Option.some),
			Effect.orElseSucceed(() => Option.none()),
		),
	);
}

const tagsToVersions = (tags: ReadonlyArray<GitHubTag>): string[] => {
	const parsed: SemVer.SemVer[] = [];
	for (const tag of tags) {
		const normalized = normalizeBunTag(tag.name);
		if (normalized) {
			const opt = tryParseSemVer(normalized);
			if (Option.isSome(opt)) {
				parsed.push(opt.value);
			}
		}
	}
	return SemVer.rsort(parsed).map((v) => v.toString());
};

export const BunResolverLive: Layer.Layer<BunResolver, never, GitHubClient | VersionCache> = Layer.effect(
	BunResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchBunTags = (freshness: Freshness = "auto") => {
			if (freshness === "cache") {
				return Effect.gen(function* () {
					const { data: cached, source } = yield* cache.get("bun");
					return { tags: (cached as CachedTagData).tags, source };
				}).pipe(
					Effect.catchTag("CacheError", () =>
						Effect.succeed({ tags: [] as ReadonlyArray<GitHubTag>, source: "cache" as const }),
					),
				);
			}

			const apiCall = retryOnRateLimit(client.listTags("oven-sh", "bun", { perPage: 100, pages: 3 })).pipe(
				Effect.tap((tags) => cache.set("bun", { tags: tags as GitHubTag[] })),
				Effect.map((tags) => ({ tags, source: "api" as const })),
			);

			if (freshness === "api") {
				return apiCall.pipe(
					Effect.catchTag("NetworkError", (err) =>
						Effect.fail(
							new FreshnessError({
								strategy: "api",
								message: `Fresh data required but network unavailable: ${err.message}`,
							}),
						),
					),
				);
			}

			// freshness === "auto" (default — current behavior)
			return apiCall.pipe(
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
		};

		return {
			resolveVersion: (versionOrRange: string) =>
				Effect.gen(function* () {
					const exactOpt = tryParseSemVer(versionOrRange);
					if (Option.isSome(exactOpt)) {
						const { tags } = yield* fetchBunTags();
						const allVersions = tagsToVersions(tags);
						if (allVersions.includes(versionOrRange)) {
							return versionOrRange;
						}
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: versionOrRange,
								message: `Bun version "${versionOrRange}" not found`,
							}),
						);
					}

					const rangeOpt = Effect.runSync(
						Range.fromString(versionOrRange).pipe(
							Effect.map(Option.some),
							Effect.orElseSucceed(() => Option.none()),
						),
					);
					if (Option.isNone(rangeOpt)) {
						return yield* Effect.fail(
							new InvalidInputError({
								field: "versionOrRange",
								value: versionOrRange,
								message: `Invalid semver range: "${versionOrRange}"`,
							}),
						);
					}

					const { tags } = yield* fetchBunTags();
					const allVersions = tagsToVersions(tags);
					const resolved = resolveVersionFromList(versionOrRange, allVersions);

					if (!resolved) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: versionOrRange,
								message: `No Bun version found matching "${versionOrRange}"`,
							}),
						);
					}

					return resolved;
				}),

			resolve: (options?: BunResolverOptions) =>
				Effect.gen(function* () {
					const semverRange = options?.semverRange ?? "*";
					const range = yield* Range.fromString(semverRange).pipe(
						Effect.mapError(
							() =>
								new InvalidInputError({
									field: "semverRange",
									value: semverRange,
									message: `Invalid semver range: "${semverRange}"`,
								}),
						),
					);

					const { tags, source } = yield* fetchBunTags(options?.freshness);
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

					const matchingVersions = allVersions.filter((v) => {
						const opt = tryParseSemVer(v);
						if (Option.isNone(opt)) return false;
						return Range.satisfies(opt.value, range);
					});

					if (matchingVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: semverRange,
								message: `No Bun versions found matching "${semverRange}"`,
							}),
						);
					}

					const increments = options?.increments ?? "patch";
					const filteredVersions = filterByIncrements(matchingVersions, increments);

					const parsedForSort = filteredVersions
						.map((v) => tryParseSemVer(v))
						.filter(Option.isSome)
						.map((o) => o.value);
					let versions = SemVer.rsort(parsedForSort).map((v) => v.toString());

					let resolvedDefault: string | undefined;
					if (options?.defaultVersion) {
						resolvedDefault = resolveVersionFromList(options.defaultVersion, allVersions);

						if (resolvedDefault && !versions.includes(resolvedDefault)) {
							const withDefault = [...versions, resolvedDefault];
							const reParsed = withDefault
								.map((v) => tryParseSemVer(v))
								.filter(Option.isSome)
								.map((o) => o.value);
							versions = SemVer.rsort(reParsed).map((v) => v.toString());
						}
					}

					const latest = versions[0];

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
