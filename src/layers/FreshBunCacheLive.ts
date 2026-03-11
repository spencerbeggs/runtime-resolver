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

export const FreshBunCacheLive: Layer.Layer<BunReleaseCache, FreshnessError, BunVersionFetcher> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))),
);
