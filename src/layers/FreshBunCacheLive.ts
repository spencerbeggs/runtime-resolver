import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { FreshnessError } from "../errors/FreshnessError.js";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
	const cache = yield* BunReleaseCache;
	const fetcher = yield* BunVersionFetcher;

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
		inputs.map((input) => BunRelease.fromInput(input)),
		{ concurrency: "unbounded" },
	).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
	yield* cache.load(releases);
});

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

/**
 * Provides the {@link BunReleaseCache} service using the "Fresh" cache strategy.
 *
 * Requires live release data from the GitHub API via {@link BunVersionFetcher}.
 * If the fetch fails for any reason — authentication errors, network errors,
 * parse errors, or rate-limit errors — the layer fails with a `FreshnessError`
 * rather than falling back to stale data.
 *
 * Use this strategy in contexts where working with outdated version data would
 * be incorrect or misleading, such as CI pipelines or tooling that must reflect
 * the true current state of Bun releases.
 *
 * The three Bun cache strategy layers are:
 * - {@link AutoBunCacheLive} — tries API first, falls back to bundled defaults on any error
 * - `FreshBunCacheLive` — requires live API data, fails with `FreshnessError` if unavailable
 * - {@link OfflineBunCacheLive} — uses only bundled defaults, no network I/O
 *
 * @see {@link BunReleaseCache}
 * @see {@link AutoBunCacheLive}
 * @see {@link OfflineBunCacheLive}
 * @public
 */
export const FreshBunCacheLive: Layer.Layer<BunReleaseCache, FreshnessError, BunVersionFetcher> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))),
);
