import { Effect } from "effect";
import type { SemVer } from "semver-effect";
import { Range, VersionCache as SemVerVersionCache } from "semver-effect";
import type { RuntimeRelease } from "../schemas/runtime-release.js";
import type { RuntimeCache } from "../services/RuntimeCache.js";

/**
 * Factory that creates a {@link RuntimeCache} implementation backed by
 * `semver-effect`'s `VersionCache`.
 *
 * The returned `Effect` must be executed within an Effect context that provides
 * a `SemVerVersionCache` service (i.e., it requires `SemVerVersionCache` in its
 * environment). The cache maintains an internal lookup map from version string
 * to the full release object so that resolved semver versions can be
 * round-tripped back to their typed release records.
 *
 * This factory is used internally by {@link BunReleaseCacheLive},
 * {@link DenoReleaseCacheLive}, and {@link NodeReleaseCacheLive} to build their
 * respective cache service implementations. Prefer those higher-level layers
 * over calling this factory directly.
 *
 * Note: `load` is not concurrency-safe. Callers must not invoke it concurrently.
 * In practice this constraint is upheld because `load` is only called from layer
 * setup and `NodeReleaseCacheLive.loadFromInputs`, both of which are serialized
 * by the Effect runtime.
 *
 * @typeParam R - The runtime release type stored in the cache. Must extend
 *   {@link RuntimeRelease}.
 *
 * @see {@link RuntimeCache}
 * @see {@link BunReleaseCacheLive}
 * @see {@link DenoReleaseCacheLive}
 * @see {@link NodeReleaseCacheLive}
 * @public
 */
export const createRuntimeCache = <R extends RuntimeRelease>(): Effect.Effect<
	RuntimeCache<R>,
	never,
	SemVerVersionCache
> =>
	Effect.gen(function* () {
		const innerCache = yield* SemVerVersionCache;
		const lookupMap = new Map<string, R>();

		return {
			// NOTE: `load` is not concurrency-safe; callers must not invoke it
			// concurrently. In practice this is only called from layer setup and
			// NodeReleaseCacheLive.loadFromInputs, which are serialized by Effect.
			load: (releases: ReadonlyArray<R>) =>
				Effect.gen(function* () {
					lookupMap.clear();
					const versions: SemVer.SemVer[] = [];
					for (const r of releases) {
						const key = r.version.toString();
						lookupMap.set(key, r);
						versions.push(r.version);
					}
					yield* innerCache.load(versions);
				}),

			resolve: (range: string) =>
				Effect.gen(function* () {
					const parsed = yield* Range.fromString(range);
					const resolved = yield* innerCache.resolve(parsed);
					const release = lookupMap.get(resolved.toString());
					if (!release) {
						return yield* Effect.die(new Error(`Cache inconsistency: ${resolved.toString()} not in lookup map`));
					}
					return release;
				}),

			releases: () =>
				Effect.gen(function* () {
					const versions = yield* innerCache.versions.pipe(
						Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)),
					);
					return versions.map((v) => lookupMap.get(v.toString())).filter((r): r is R => r !== undefined);
				}),

			filter: (range: string) =>
				Effect.gen(function* () {
					const parsed = yield* Range.fromString(range);
					const filtered = yield* innerCache
						.filter(parsed)
						.pipe(Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)));
					return filtered.map((v) => lookupMap.get(v.toString())).filter((r): r is R => r !== undefined);
				}),

			latest: () =>
				Effect.gen(function* () {
					const version = yield* innerCache.latest();
					const release = lookupMap.get(version.toString());
					if (!release) {
						return yield* Effect.die(new Error(`Cache inconsistency: ${version.toString()} not in lookup map`));
					}
					return release;
				}),

			latestByMajor: () =>
				Effect.gen(function* () {
					const versions = yield* innerCache
						.latestByMajor()
						.pipe(Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)));
					return versions.map((v) => lookupMap.get(v.toString())).filter((r): r is R => r !== undefined);
				}),

			latestByMinor: () =>
				Effect.gen(function* () {
					const versions = yield* innerCache
						.latestByMinor()
						.pipe(Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)));
					return versions.map((v) => lookupMap.get(v.toString())).filter((r): r is R => r !== undefined);
				}),
		};
	});
