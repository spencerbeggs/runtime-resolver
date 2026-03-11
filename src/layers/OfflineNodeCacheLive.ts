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

/**
 * Provides the {@link NodeReleaseCache} service using the "Offline" cache strategy.
 *
 * Uses only the bundled default Node.js release data and schedule data that were
 * baked in at build time. Makes no network requests and has no runtime
 * dependencies. This layer always succeeds immediately.
 *
 * Use this strategy in environments where network access is unavailable or
 * undesirable (e.g., air-gapped systems, hermetic test environments, or any
 * context where version data from the bundle is sufficient).
 *
 * The three Node cache strategy layers are:
 * - {@link AutoNodeCacheLive} — tries API first, falls back to bundled defaults on any error
 * - {@link FreshNodeCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - `OfflineNodeCacheLive` — uses only bundled defaults, no network I/O
 *
 * @see {@link NodeReleaseCache}
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @public
 */
export const OfflineNodeCacheLive: Layer.Layer<NodeReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
