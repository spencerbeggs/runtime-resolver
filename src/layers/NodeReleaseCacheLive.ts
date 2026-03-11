import type { DateTime } from "effect";
import { Effect, Layer, Ref } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { NodeReleaseInput } from "../schemas/node-release.js";
import { NodeRelease } from "../schemas/node-release.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeSchedule } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

/**
 * Low-level layer that constructs the {@link NodeReleaseCache} service backed by
 * a `SemVerVersionCache` instance from `semver-effect`.
 *
 * This layer is more complex than the Bun and Deno equivalents because it manages
 * additional LTS schedule state via an internal `Ref`. The schedule is stored
 * separately from the version list so that calling `updateSchedule` can
 * transparently rebuild all release objects with the latest phase information
 * without reloading data from the network.
 *
 * This layer wires up the cache storage but does not populate it with any
 * release data. Callers are responsible for calling `updateSchedule` and
 * `loadFromInputs` after construction. In normal usage you should prefer the
 * higher-level cache strategy layers instead of using this layer directly:
 * - {@link AutoNodeCacheLive} — API with fallback to bundled defaults
 * - {@link FreshNodeCacheLive} — API only, fails if unavailable
 * - {@link OfflineNodeCacheLive} — bundled defaults only
 *
 * @see {@link NodeReleaseCache}
 * @see {@link createRuntimeCache}
 * @internal
 */
export const NodeReleaseCacheLive: Layer.Layer<NodeReleaseCache, never, SemVerVersionCache> = Layer.effect(
	NodeReleaseCache,
	Effect.gen(function* () {
		const scheduleRef = yield* Ref.make(NodeSchedule.fromData({}));
		const inner = yield* createRuntimeCache<NodeRelease>();

		// Held separately so we can rebuild releases when schedule updates
		let currentInputs: ReadonlyArray<NodeReleaseInput> = [];

		const buildAndLoad = (inputs: ReadonlyArray<NodeReleaseInput>) =>
			Effect.gen(function* () {
				const releases: NodeRelease[] = [];
				for (const input of inputs) {
					const release = yield* NodeRelease.fromInput(input, scheduleRef).pipe(
						Effect.catchAll(() => Effect.succeed(null)),
					);
					if (release) releases.push(release);
				}
				yield* inner.load(releases);
			});

		return {
			// -- RuntimeCache<NodeRelease> delegation --
			load: (releases) => inner.load(releases),
			resolve: (range) => inner.resolve(range),
			releases: () => inner.releases(),
			filter: (range) => inner.filter(range),
			latest: () => inner.latest(),
			latestByMajor: () => inner.latestByMajor(),
			latestByMinor: () => inner.latestByMinor(),

			// -- Node-specific --
			updateSchedule: (data: NodeScheduleData) =>
				Effect.gen(function* () {
					yield* Ref.set(scheduleRef, NodeSchedule.fromData(data));
					// Rebuild releases if we have stored inputs
					if (currentInputs.length > 0) {
						yield* buildAndLoad(currentInputs);
					}
				}),

			loadFromInputs: (inputs: ReadonlyArray<NodeReleaseInput>) =>
				Effect.gen(function* () {
					currentInputs = inputs;
					yield* buildAndLoad(inputs);
				}),

			ltsReleases: (now?: DateTime.DateTime) =>
				Effect.gen(function* () {
					const all = yield* inner.releases();
					const results: NodeRelease[] = [];
					for (const r of all) {
						const phase = yield* r.phase(now);
						if (phase === "active-lts" || phase === "maintenance-lts") {
							results.push(r);
						}
					}
					return results;
				}),

			currentReleases: (now?: DateTime.DateTime) =>
				Effect.gen(function* () {
					const all = yield* inner.releases();
					const results: NodeRelease[] = [];
					for (const r of all) {
						const phase = yield* r.phase(now);
						if (phase === "current") {
							results.push(r);
						}
					}
					return results;
				}),
		};
	}),
);
