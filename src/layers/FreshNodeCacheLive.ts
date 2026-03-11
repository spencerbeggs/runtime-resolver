import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { FreshnessError } from "../errors/FreshnessError.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
	const cache = yield* NodeReleaseCache;
	const versionFetcher = yield* NodeVersionFetcher;
	const scheduleFetcher = yield* NodeScheduleFetcher;

	const [fetchResult, scheduleData] = yield* Effect.all([versionFetcher.fetch(), scheduleFetcher.fetch()]).pipe(
		Effect.catchTags({
			NetworkError: (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but network unavailable: ${err.message}`,
					}),
				),
			ParseError: (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but response could not be parsed: ${err.message}`,
					}),
				),
		}),
	);

	yield* cache.updateSchedule(scheduleData);
	yield* cache.loadFromInputs(fetchResult.inputs);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const FreshNodeCacheLive: Layer.Layer<
	NodeReleaseCache,
	FreshnessError,
	NodeVersionFetcher | NodeScheduleFetcher
> = BaseCacheLayer.pipe(Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))));
