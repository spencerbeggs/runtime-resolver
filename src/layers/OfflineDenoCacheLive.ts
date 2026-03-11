import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { denoDefaultInputs } from "../data/deno-defaults.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
	const cache = yield* DenoReleaseCache;
	const releases = yield* Effect.all(
		denoDefaultInputs.map((input) => DenoRelease.fromInput(input)),
		{ concurrency: "unbounded" },
	).pipe(Effect.orElseSucceed(() => [] as DenoRelease[]));
	yield* cache.load(releases);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

/**
 * Provides the {@link DenoReleaseCache} service using the "Offline" cache strategy.
 *
 * Uses only the bundled default Deno release data that was baked in at build time.
 * Makes no network requests and has no runtime dependencies. This layer always
 * succeeds immediately.
 *
 * Use this strategy in environments where network access is unavailable or
 * undesirable (e.g., air-gapped systems, hermetic test environments, or any
 * context where version data from the bundle is sufficient).
 *
 * The three Deno cache strategy layers are:
 * - {@link AutoDenoCacheLive} — tries API first, falls back to bundled defaults on any error
 * - {@link FreshDenoCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - `OfflineDenoCacheLive` — uses only bundled defaults, no network I/O
 *
 * @see {@link DenoReleaseCache}
 * @see {@link AutoDenoCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @public
 */
export const OfflineDenoCacheLive: Layer.Layer<DenoReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
