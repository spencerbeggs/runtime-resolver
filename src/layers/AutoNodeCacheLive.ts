import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { nodeDefaultInputs, nodeDefaultScheduleData } from "../data/node-defaults.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const setup = Effect.gen(function* () {
	const cache = yield* NodeReleaseCache;
	const versionFetcher = yield* NodeVersionFetcher;
	const scheduleFetcher = yield* NodeScheduleFetcher;

	const nodeDefaults = { inputs: nodeDefaultInputs, scheduleData: nodeDefaultScheduleData };
	const { inputs, scheduleData } = yield* Effect.gen(function* () {
		const [fetchResult, schedule] = yield* Effect.all([versionFetcher.fetch(), scheduleFetcher.fetch()]);
		return { inputs: fetchResult.inputs, scheduleData: schedule };
	}).pipe(
		Effect.catchTags({
			NetworkError: () => Effect.succeed(nodeDefaults),
			ParseError: () => Effect.succeed(nodeDefaults),
		}),
	);

	yield* cache.updateSchedule(scheduleData);
	yield* cache.loadFromInputs(inputs);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const AutoNodeCacheLive: Layer.Layer<NodeReleaseCache, never, NodeVersionFetcher | NodeScheduleFetcher> =
	BaseCacheLayer.pipe(Layer.tap((ctx) => setup.pipe(Effect.provide(ctx))));
