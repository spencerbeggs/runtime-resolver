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

export const AutoDenoCacheLive: Layer.Layer<DenoReleaseCache, never, DenoVersionFetcher> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => setup.pipe(Effect.provide(ctx))),
);
