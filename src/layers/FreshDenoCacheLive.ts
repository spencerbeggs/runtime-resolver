import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { FreshnessError } from "../errors/FreshnessError.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
	const cache = yield* DenoReleaseCache;
	const fetcher = yield* DenoVersionFetcher;

	const { inputs } = yield* fetcher.fetch().pipe(
		Effect.catchTags({
			AuthenticationError: (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but authentication failed: ${err.message}`,
					}),
				),
			NetworkError: (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but network unavailable: ${err.message}`,
					}),
				),
			ParseError: (err) =>
				Effect.fail(
					new FreshnessError({ strategy: "api", message: `Fresh data required but parse failed: ${err.message}` }),
				),
			RateLimitError: (err) =>
				Effect.fail(
					new FreshnessError({
						strategy: "api",
						message: `Fresh data required but rate limit exceeded: ${err.message}`,
					}),
				),
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
 * Provides the {@link DenoReleaseCache} service using the "Fresh" cache strategy.
 *
 * Requires live release data from the GitHub API via {@link DenoVersionFetcher}.
 * If the fetch fails for any reason — authentication errors, network errors,
 * parse errors, or rate-limit errors — the layer fails with a `FreshnessError`
 * rather than falling back to stale data.
 *
 * Use this strategy in contexts where working with outdated version data would
 * be incorrect or misleading, such as CI pipelines or tooling that must reflect
 * the true current state of Deno releases.
 *
 * The three Deno cache strategy layers are:
 * - {@link AutoDenoCacheLive} — tries API first, falls back to bundled defaults on any error
 * - `FreshDenoCacheLive` — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineDenoCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link DenoReleaseCache}
 * @see {@link AutoDenoCacheLive}
 * @see {@link OfflineDenoCacheLive}
 * @public
 */
export const FreshDenoCacheLive: Layer.Layer<DenoReleaseCache, FreshnessError, DenoVersionFetcher> =
	BaseCacheLayer.pipe(Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))));
