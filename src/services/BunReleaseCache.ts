import { Context } from "effect";
import type { BunRelease } from "../schemas/bun-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Specialisation of {@link RuntimeCache} for Bun release objects.
 *
 * @see {@link BunRelease}
 * @see {@link RuntimeCache}
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 *
 * @public
 */
export type BunReleaseCache = RuntimeCache<BunRelease>;

/**
 * Service tag and companion object for {@link BunReleaseCache}.
 *
 * Acts as both the TypeScript service interface (via the type alias above) and
 * the Effect dependency tag used for dependency injection. Yield this tag
 * inside `Effect.gen` to access the cache implementation provided by one of
 * the cache layers.
 *
 * @example
 * ```typescript
 * import type { BunRelease } from "runtime-resolver";
 * import { BunReleaseCache, OfflineBunCacheLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const cache = yield* BunReleaseCache;
 * 	const releases = yield* cache.releases();
 * 	console.log(releases.length);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(OfflineBunCacheLive)));
 * ```
 *
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 *
 * @public
 */
export const BunReleaseCache = Context.GenericTag<BunReleaseCache>("BunReleaseCache");
