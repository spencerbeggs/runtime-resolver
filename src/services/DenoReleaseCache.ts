import { Context } from "effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Specialisation of {@link RuntimeCache} for Deno release objects.
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
 * @see {@link DenoRelease}
 * @see {@link RuntimeCache}
 * @see {@link AutoDenoCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @see {@link OfflineDenoCacheLive}
 *
 * @public
 */
export class DenoReleaseCache extends Context.Tag("runtime-resolver/DenoReleaseCache")<
	DenoReleaseCache,
	RuntimeCache<DenoRelease>
>() {}
