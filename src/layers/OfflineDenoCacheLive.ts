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

export const OfflineDenoCacheLive: Layer.Layer<DenoReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
