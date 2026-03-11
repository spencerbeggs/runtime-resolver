import { Context } from "effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Specialisation of {@link RuntimeCache} for Deno release objects.
 *
 * @see {@link DenoRelease}
 * @see {@link RuntimeCache}
 * @see {@link AutoDenoCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @see {@link OfflineDenoCacheLive}
 *
 * @public
 */
export type DenoReleaseCache = RuntimeCache<DenoRelease>;

/**
 * Service tag and companion object for {@link DenoReleaseCache}.
 *
 * Acts as both the TypeScript service interface (via the type alias above) and
 * the Effect dependency tag used for dependency injection. Yield this tag
 * inside `Effect.gen` to access the cache implementation provided by one of
 * the cache layers.
 *
 * @example
 * ```typescript
 * import type { DenoRelease } from "runtime-resolver";
 * import { DenoReleaseCache, OfflineDenoCacheLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const cache = yield* DenoReleaseCache;
 * 	const latest = yield* cache.latest();
 * 	console.log(latest.version.toString());
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(OfflineDenoCacheLive)));
 * ```
 *
 * @see {@link AutoDenoCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @see {@link OfflineDenoCacheLive}
 *
 * @public
 */
export const DenoReleaseCache = Context.GenericTag<DenoReleaseCache>("DenoReleaseCache");
