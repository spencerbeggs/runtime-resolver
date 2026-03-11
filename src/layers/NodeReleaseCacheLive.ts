import type { DateTime } from "effect";
import { Effect, Layer, Ref } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { NodeReleaseInput } from "../schemas/node-release.js";
import { NodeRelease } from "../schemas/node-release.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeSchedule } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

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
