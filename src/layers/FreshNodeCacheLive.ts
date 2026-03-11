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

/**
 * Provides the {@link NodeReleaseCache} service using the "Fresh" cache strategy.
 *
 * Requires live release data from `nodejs.org/dist/index.json` via
 * {@link NodeVersionFetcher} and the release schedule from the `nodejs/Release`
 * repository via {@link NodeScheduleFetcher}. If either fetch fails — due to
 * network errors or parse errors — the layer fails with a `FreshnessError`
 * rather than falling back to stale data.
 *
 * Use this strategy in contexts where working with outdated version data would
 * be incorrect or misleading, such as CI pipelines or tooling that must reflect
 * the true current state of Node.js releases and LTS schedule.
 *
 * The three Node cache strategy layers are:
 * - {@link AutoNodeCacheLive} — tries API first, falls back to bundled defaults on any error
 * - `FreshNodeCacheLive` — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineNodeCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link NodeReleaseCache}
 * @see {@link AutoNodeCacheLive}
 * @see {@link OfflineNodeCacheLive}
 * @public
 */
export const FreshNodeCacheLive: Layer.Layer<
	NodeReleaseCache,
	FreshnessError,
	NodeVersionFetcher | NodeScheduleFetcher
> = BaseCacheLayer.pipe(Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))));
