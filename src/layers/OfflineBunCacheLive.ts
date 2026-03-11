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

export const OfflineBunCacheLive: Layer.Layer<BunReleaseCache> = BaseCacheLayer.pipe(
	Layer.tap((ctx) => offlineSetup.pipe(Effect.provide(ctx))),
);
