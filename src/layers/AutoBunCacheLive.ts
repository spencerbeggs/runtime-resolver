import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { bunDefaultInputs } from "../data/bun-defaults.js";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const setup = Effect.gen(function* () {
	const cache = yield* BunReleaseCache;
	const fetcher = yield* BunVersionFetcher;

	const inputs = yield* fetcher.fetch().pipe(
		Effect.map((result) => result.inputs),
		Effect.catchTags({
			AuthenticationError: () => Effect.succeed(bunDefaultInputs),
			NetworkError: () => Effect.succeed(bunDefaultInputs),
			ParseError: () => Effect.succeed(bunDefaultInputs),
			RateLimitError: () => Effect.succeed(bunDefaultInputs),
		}),
	);

	const releases = yield* Effect.all(
		inputs.map((input) => BunRelease.fromInput(input)),
		{ concurrency: "unbounded" },
	).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
	yield* cache.load(releases);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

/**
 * Provides the {@link BunReleaseCache} service using the "Auto" cache strategy.
 *
 * Attempts to fetch live release data from the GitHub API via
 * {@link BunVersionFetcher}. If the fetch fails for any reason — authentication
 * errors, network errors, parse errors, or rate-limit errors — it silently falls
 * back to the bundled default release data so the layer always succeeds.
 *
 * Use this strategy when you want the freshest data when available but can
 * tolerate slightly stale bundled data in degraded environments.
 *
 * The three Bun cache strategy layers are:
 * - `AutoBunCacheLive` — tries API first, falls back to bundled defaults on any error
 * - {@link FreshBunCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineBunCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link BunReleaseCache}
 * @see {@link FreshBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 * @public
 */
export const AutoBunCacheLive: Layer.Layer<BunReleaseCache, never, BunVersionFetcher> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => setup.pipe(Effect.provide(ctx))),
);
