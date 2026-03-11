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

/**
 * Provides the {@link NodeReleaseCache} service using the "Auto" cache strategy.
 *
 * Attempts to fetch live release data from `nodejs.org/dist/index.json` via
 * {@link NodeVersionFetcher} and the release schedule from the `nodejs/Release`
 * repository via {@link NodeScheduleFetcher}. If either fetch fails — due to
 * network errors or parse errors — the layer silently falls back to bundled
 * default data (both version list and schedule) so it always succeeds.
 *
 * Node.js requires both a version fetcher and a schedule fetcher because LTS and
 * maintenance phase information is tracked separately from the version index.
 *
 * The three Node cache strategy layers are:
 * - `AutoNodeCacheLive` — tries API first, falls back to bundled defaults on any error
 * - {@link FreshNodeCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineNodeCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link NodeReleaseCache}
 * @see {@link FreshNodeCacheLive}
 * @see {@link OfflineNodeCacheLive}
 * @public
 */
export const AutoNodeCacheLive: Layer.Layer<NodeReleaseCache, never, NodeVersionFetcher | NodeScheduleFetcher> =
	BaseCacheLayer.pipe(Layer.tap((ctx) => setup.pipe(Effect.provide(ctx))));
