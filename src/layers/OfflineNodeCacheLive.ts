import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { nodeDefaultInputs, nodeDefaultScheduleData } from "../data/node-defaults.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
	const cache = yield* NodeReleaseCache;
	yield* cache.updateSchedule(nodeDefaultScheduleData);
	yield* cache.loadFromInputs(nodeDefaultInputs);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const OfflineNodeCacheLive: Layer.Layer<NodeReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
