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

export const FreshDenoCacheLive: Layer.Layer<DenoReleaseCache, FreshnessError, DenoVersionFetcher> =
	BaseCacheLayer.pipe(Layer.tap((ctx) => freshSetup.pipe(Effect.provide(ctx))));
