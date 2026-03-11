import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { denoDefaultInputs } from "../data/deno-defaults.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const setup = Effect.gen(function* () {
	const cache = yield* DenoReleaseCache;
	const fetcher = yield* DenoVersionFetcher;

	const inputs = yield* fetcher.fetch().pipe(
		Effect.map((result) => result.inputs),
		Effect.catchTags({
			AuthenticationError: () => Effect.succeed(denoDefaultInputs),
			NetworkError: () => Effect.succeed(denoDefaultInputs),
			ParseError: () => Effect.succeed(denoDefaultInputs),
			RateLimitError: () => Effect.succeed(denoDefaultInputs),
		}),
	);

	const releases = yield* Effect.all(
		inputs.map((input) => DenoRelease.fromInput(input)),
		{ concurrency: "unbounded" },
	).pipe(Effect.orElseSucceed(() => [] as DenoRelease[]));
	yield* cache.load(releases);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

/**
 * Provides the {@link DenoReleaseCache} service using the "Auto" cache strategy.
 *
 * Attempts to fetch live release data from the GitHub API via
 * {@link DenoVersionFetcher}. If the fetch fails for any reason — authentication
 * errors, network errors, parse errors, or rate-limit errors — it silently falls
 * back to the bundled default release data so the layer always succeeds.
 *
 * Use this strategy when you want the freshest data when available but can
 * tolerate slightly stale bundled data in degraded environments.
 *
 * The three Deno cache strategy layers are:
 * - `AutoDenoCacheLive` — tries API first, falls back to bundled defaults on any error
 * - {@link FreshDenoCacheLive} — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineDenoCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link DenoReleaseCache}
 * @see {@link FreshDenoCacheLive}
 * @see {@link OfflineDenoCacheLive}
 * @public
 */
export const AutoDenoCacheLive: Layer.Layer<DenoReleaseCache, never, DenoVersionFetcher> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => setup.pipe(Effect.provide(ctx))),
);
