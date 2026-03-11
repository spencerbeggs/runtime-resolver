import { Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { BunRelease } from "../schemas/bun-release.js";
import type { Increments } from "../schemas/common.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import type { BunResolverOptions } from "../services/BunResolver.js";
import { BunResolver } from "../services/BunResolver.js";

/**
 * Provides the {@link BunResolver} service backed by a {@link BunReleaseCache}.
 *
 * This layer composes with any of the three Bun cache strategy layers to form
 * a complete resolver stack. It implements semver range filtering and increment
 * grouping (latest per major, latest per minor, or all patch versions) using
 * the releases already loaded into the cache.
 *
 * @example
 * ```ts
 * import { BunResolverLive, AutoBunCacheLive, BunVersionFetcherLive, GitHubClientLive, GitHubAutoAuth } from "runtime-resolver";
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { BunResolver } from "runtime-resolver";
 * import { Effect, Layer } from "effect";
 *
 * const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
 * const CacheLayer = AutoBunCacheLive.pipe(Layer.provide(BunVersionFetcherLive.pipe(Layer.provide(GitHubLayer))));
 * const ResolverLayer = BunResolverLive.pipe(Layer.provide(CacheLayer));
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* BunResolver;
 *   const result = yield* resolver.resolve({ semverRange: "^1.0.0" });
 *   console.log(result.latest);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(ResolverLayer)));
 * ```
 *
 * @see {@link BunResolver}
 * @see {@link BunReleaseCache}
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 * @public
 */
export const BunResolverLive: Layer.Layer<BunResolver, never, BunReleaseCache> = Layer.effect(
	BunResolver,
	Effect.gen(function* () {
		const cache = yield* BunReleaseCache;

		return {
			resolve: (options?: BunResolverOptions) =>
				Effect.gen(function* () {
					const semverRange = options?.semverRange ?? "*";
					const increments: Increments = options?.increments ?? "latest";

					const matching = yield* cache
						.filter(semverRange)
						.pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<BunRelease>)));

					let resultReleases: BunRelease[];
					if (increments === "latest") {
						const groups = new Map<number, BunRelease>();
						for (const r of matching) {
							const existing = groups.get(r.version.major);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(r.version.major, r);
							}
						}
						resultReleases = [...groups.values()];
					} else if (increments === "minor") {
						const groups = new Map<string, BunRelease>();
						for (const r of matching) {
							const key = `${r.version.major}.${r.version.minor}`;
							const existing = groups.get(key);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(key, r);
							}
						}
						resultReleases = [...groups.values()];
					} else {
						resultReleases = [...matching];
					}

					if (resultReleases.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "bun",
								constraint: semverRange,
								message: `No Bun versions found matching "${semverRange}"`,
							}),
						);
					}

					const sorted = SemVer.rsort(resultReleases.map((r) => r.version));
					const versions = sorted.map((v) => v.toString());
					const latest = versions[0];

					let resolvedDefault: string | undefined;
					if (options?.defaultVersion) {
						resolvedDefault = yield* cache.resolve(options.defaultVersion).pipe(
							Effect.map((r) => r.version.toString()),
							Effect.catchAll(() => Effect.succeed(undefined)),
						);
					}

					return {
						source: "api" as const,
						versions,
						latest,
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					};
				}),
		};
	}),
);
