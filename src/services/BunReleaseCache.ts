import { Context } from "effect";
import type { BunRelease } from "../schemas/bun-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Specialisation of {@link RuntimeCache} for Bun release objects.
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
 * @see {@link BunRelease}
 * @see {@link RuntimeCache}
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 *
 * @public
 */
export class BunReleaseCache extends Context.Tag("runtime-resolver/BunReleaseCache")<
	BunReleaseCache,
	RuntimeCache<BunRelease>
>() {}
