import type { Effect } from "effect";
import type { EmptyCacheError, InvalidRangeError, UnsatisfiedRangeError } from "semver-effect";
import type { RuntimeRelease } from "../schemas/runtime-release.js";

/**
 * Generic in-memory cache service for a typed runtime release collection,
 * built on top of semver-effect's version cache primitives.
 *
 * Concrete instantiations are {@link BunReleaseCache}, {@link DenoReleaseCache},
 * and {@link NodeReleaseCache}. The canonical factory function for obtaining a
 * `RuntimeCache` implementation is {@link createRuntimeCache}.
 *
 * @typeParam R - A {@link RuntimeRelease} subtype specific to the runtime
 * (e.g. `BunRelease`, `DenoRelease`, `NodeRelease`).
 *
 * @example
 * ```typescript
 * import type { BunRelease } from "runtime-resolver";
 * import { BunReleaseCache, OfflineBunCacheLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const cache = yield* BunReleaseCache;
 * 	const latest = yield* cache.latest();
 * 	console.log(latest.version.toString());
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(OfflineBunCacheLive)));
 * ```
 *
 * @see {@link BunReleaseCache}
 * @see {@link DenoReleaseCache}
 * @see {@link NodeReleaseCache}
 * @see {@link createRuntimeCache}
 *
 * @public
 */
export interface RuntimeCache<R extends RuntimeRelease> {
	/**
	 * Populates the cache with the given array of typed release objects,
	 * replacing any previously loaded entries.
	 *
	 * @param releases - The full set of releases to store.
	 */
	readonly load: (releases: ReadonlyArray<R>) => Effect.Effect<void>;

	/**
	 * Finds the single best-matching release for the given semver range string,
	 * preferring the highest satisfying version.
	 *
	 * Fails with {@link InvalidRangeError} when `range` is not a valid semver
	 * range expression, or with {@link UnsatisfiedRangeError} when no cached
	 * release satisfies the range.
	 *
	 * @param range - A semver range string (e.g. `">=1.0.0 <2.0.0"`).
	 */
	readonly resolve: (range: string) => Effect.Effect<R, InvalidRangeError | UnsatisfiedRangeError>;

	/**
	 * Returns the complete list of all releases currently held in the cache,
	 * in the order they were loaded.
	 */
	readonly releases: () => Effect.Effect<ReadonlyArray<R>>;

	/**
	 * Returns all cached releases whose version satisfies the given semver
	 * range string.
	 *
	 * Fails with {@link InvalidRangeError} when `range` is not a valid semver
	 * range expression.
	 *
	 * @param range - A semver range string (e.g. `"^20.0.0"`).
	 */
	readonly filter: (range: string) => Effect.Effect<ReadonlyArray<R>, InvalidRangeError>;

	/**
	 * Returns the release with the highest version among all entries in the
	 * cache.
	 *
	 * Fails with {@link EmptyCacheError} when the cache contains no releases.
	 */
	readonly latest: () => Effect.Effect<R, EmptyCacheError>;

	/**
	 * Returns one release per major version line, each being the highest
	 * available version within that major line.
	 *
	 * Returns an empty array when the cache is empty.
	 */
	readonly latestByMajor: () => Effect.Effect<ReadonlyArray<R>>;

	/**
	 * Returns one release per minor version line, each being the highest
	 * available patch version within that minor line.
	 *
	 * Returns an empty array when the cache is empty.
	 */
	readonly latestByMinor: () => Effect.Effect<ReadonlyArray<R>>;
}
