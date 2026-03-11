import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { bunDefaultInputs } from "../data/bun-defaults.js";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
	const cache = yield* BunReleaseCache;
	const releases = yield* Effect.all(
		bunDefaultInputs.map((input) => BunRelease.fromInput(input)),
		{ concurrency: "unbounded" },
	).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
	yield* cache.load(releases);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

/**
 * Provides the {@link BunReleaseCache} service using the "Offline" cache strategy.
 *
 * Uses only the bundled default Bun release data that was baked in at build time.
 * Makes no network requests and has no runtime dependencies. This layer always
 * succeeds immediately.
 *
 * Use this strategy in environments where network access is unavailable or
 * undesirable (e.g., air-gapped systems, hermetic test environments, or any
 * context where version data from the bundle is sufficient).
 *
 * The three Bun cache strategy layers are:
 * - {@link AutoBunCacheLive} — tries API first, falls back to bundled defaults on any error
 * - {@link FreshBunCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - `OfflineBunCacheLive` — uses only bundled defaults, no network I/O
 *
 * @see {@link BunReleaseCache}
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @public
 */
export const OfflineBunCacheLive: Layer.Layer<BunReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
