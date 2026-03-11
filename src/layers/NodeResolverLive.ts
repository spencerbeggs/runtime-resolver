import { DateTime, Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, NodePhase } from "../schemas/common.js";
import type { NodeRelease } from "../schemas/node-release.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import type { NodeResolverOptions } from "../services/NodeResolver.js";
import { NodeResolver } from "../services/NodeResolver.js";

/**
 * Provides the {@link NodeResolver} service backed by a {@link NodeReleaseCache}.
 *
 * This layer composes with any of the three Node cache strategy layers to form
 * a complete resolver stack. In addition to semver range filtering and increment
 * grouping, it supports filtering by Node.js release phase (e.g., `"current"`,
 * `"active-lts"`, `"maintenance-lts"`, `"end-of-life"`) and automatically
 * determines the current LTS version from the loaded schedule data.
 *
 * @example
 * ```ts
 * import {
 *   NodeResolverLive, AutoNodeCacheLive,
 *   NodeVersionFetcherLive, NodeScheduleFetcherLive,
 *   GitHubClientLive, GitHubAutoAuth,
 * } from "runtime-resolver";
 * import { NodeResolver } from "runtime-resolver";
 * import { Effect, Layer } from "effect";
 *
 * const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
 * const FetchersLayer = Layer.merge(
 *   NodeVersionFetcherLive.pipe(Layer.provide(GitHubLayer)),
 *   NodeScheduleFetcherLive.pipe(Layer.provide(GitHubLayer)),
 * );
 * const CacheLayer = AutoNodeCacheLive.pipe(Layer.provide(FetchersLayer));
 * const ResolverLayer = NodeResolverLive.pipe(Layer.provide(CacheLayer));
 *
 * const program = Effect.gen(function* () {
 *   const resolver = yield* NodeResolver;
 *   // Resolve only active-LTS and maintenance-LTS releases in the ^20 range
 *   const result = yield* resolver.resolve({
 *     semverRange: "^20.0.0",
 *     phases: ["active-lts", "maintenance-lts"],
 *   });
 *   console.log(result.lts);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(ResolverLayer)));
 * ```
 *
 * @see {@link NodeResolver}
 * @see {@link NodeReleaseCache}
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @see {@link OfflineNodeCacheLive}
 * @public
 */
export const NodeResolverLive: Layer.Layer<NodeResolver, never, NodeReleaseCache> = Layer.effect(
	NodeResolver,
	Effect.gen(function* () {
		const cache = yield* NodeReleaseCache;

		return {
			resolve: (options?: NodeResolverOptions) =>
				Effect.gen(function* () {
					const semverRange = options?.semverRange ?? "*";
					const phases: ReadonlyArray<NodePhase> = options?.phases ?? ["current", "active-lts"];
					const increments: Increments = options?.increments ?? "latest";
					const now = options?.date ? DateTime.unsafeMake(options.date) : DateTime.unsafeMake(new Date());

					// Get all releases matching range
					const matching = yield* cache
						.filter(semverRange)
						.pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<NodeRelease>)));

					// Filter by phase
					const phaseFiltered: NodeRelease[] = [];
					for (const r of matching) {
						const phase = yield* r.phase(now);
						if (phase && phases.includes(phase)) {
							phaseFiltered.push(r);
						}
					}

					// Apply increments
					let resultReleases: NodeRelease[];
					if (increments === "latest") {
						const groups = new Map<number, NodeRelease>();
						for (const r of phaseFiltered) {
							const existing = groups.get(r.version.major);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(r.version.major, r);
							}
						}
						resultReleases = [...groups.values()];
					} else if (increments === "minor") {
						const groups = new Map<string, NodeRelease>();
						for (const r of phaseFiltered) {
							const key = `${r.version.major}.${r.version.minor}`;
							const existing = groups.get(key);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(key, r);
							}
						}
						resultReleases = [...groups.values()];
					} else {
						resultReleases = phaseFiltered;
					}

					if (resultReleases.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "node",
								constraint: semverRange,
								message: `No Node.js versions found matching "${semverRange}" with phases [${phases.join(", ")}]`,
							}),
						);
					}

					// Sort descending
					const sorted = SemVer.rsort(resultReleases.map((r) => r.version));
					const sortedReleases = sorted
						.map((v) => resultReleases.find((r) => SemVer.equal(r.version, v)))
						.filter((r): r is NodeRelease => r !== undefined);

					const versions = sortedReleases.map((r) => r.version.toString());
					const latest = versions[0];

					// Determine LTS
					const ltsReleases = yield* cache.ltsReleases(now);
					const ltsVersions = ltsReleases.filter((r) => versions.includes(r.version.toString())).map((r) => r.version);
					const lts = ltsVersions.length > 0 ? SemVer.rsort(ltsVersions)[0].toString() : undefined;

					// Handle default version
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
						...(lts ? { lts } : {}),
						...(resolvedDefault ? { default: resolvedDefault } : { ...(lts ? { default: lts } : {}) }),
					};
				}),
		};
	}),
);
