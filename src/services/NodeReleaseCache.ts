import type { DateTime, Effect } from "effect";
import { Context } from "effect";
import type { NodeRelease, NodeReleaseInput } from "../schemas/node-release.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Node.js-specific cache service that extends {@link RuntimeCache} with
 * additional operations for lifecycle schedule data and LTS / current
 * release filtering.
 *
 * Unlike the Bun and Deno equivalents this interface is not a plain type alias
 * — it adds four Node-specific methods on top of the generic cache contract.
 *
 * @see {@link NodeRelease}
 * @see {@link NodeScheduleData}
 * @see {@link RuntimeCache}
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @see {@link OfflineNodeCacheLive}
 *
 * @example
 * ```typescript
 * import type { NodeRelease } from "runtime-resolver";
 * import { NodeReleaseCache, OfflineNodeCacheLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const cache = yield* NodeReleaseCache;
 * 	const lts = yield* cache.ltsReleases();
 * 	for (const release of lts) {
 * 		console.log(release.version.toString(), release.phase);
 * 	}
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(OfflineNodeCacheLive)));
 * ```
 *
 * @public
 */
export interface NodeReleaseCache extends RuntimeCache<NodeRelease> {
	/**
	 * Merges Node.js release-schedule data into the cache, updating lifecycle
	 * phase information (LTS dates, end-of-life dates, etc.) for every major
	 * release line.
	 *
	 * @param data - Parsed schedule payload, typically fetched via
	 * {@link NodeScheduleFetcher}.
	 *
	 * @see {@link NodeScheduleData}
	 */
	readonly updateSchedule: (data: NodeScheduleData) => Effect.Effect<void>;

	/**
	 * Populates the cache from raw {@link NodeReleaseInput} records (as
	 * returned by the Node.js release index JSON) rather than from already-
	 * decoded {@link NodeRelease} objects.
	 *
	 * Prefer this over `load` when consuming data directly from the Node.js
	 * distribution server.
	 *
	 * @param inputs - An array of un-decoded release index entries.
	 *
	 * @see {@link NodeReleaseInput}
	 */
	readonly loadFromInputs: (inputs: ReadonlyArray<NodeReleaseInput>) => Effect.Effect<void>;

	/**
	 * Returns all cached releases whose lifecycle phase is `"active-lts"` or
	 * `"maintenance-lts"` as of the given point in time.
	 *
	 * When `now` is omitted the current wall-clock time is used.
	 *
	 * @param now - Optional reference timestamp for phase evaluation.
	 *
	 * @see {@link NodeRelease}
	 */
	readonly ltsReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;

	/**
	 * Returns all cached releases whose lifecycle phase is `"current"` as of
	 * the given point in time.
	 *
	 * When `now` is omitted the current wall-clock time is used.
	 *
	 * @param now - Optional reference timestamp for phase evaluation.
	 *
	 * @see {@link NodeRelease}
	 */
	readonly currentReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;
}

/**
 * Service tag and companion object for {@link NodeReleaseCache}.
 *
 * Acts as both the TypeScript service interface and the Effect dependency tag
 * used for dependency injection (companion object pattern). Yield this tag
 * inside `Effect.gen` to access the cache implementation supplied by one of
 * the Node cache layers.
 *
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @see {@link OfflineNodeCacheLive}
 *
 * @public
 */
export const NodeReleaseCache = Context.GenericTag<NodeReleaseCache>("NodeReleaseCache");
