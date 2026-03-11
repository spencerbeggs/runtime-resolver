import { Layer } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

/**
 * Low-level layer that constructs the {@link BunReleaseCache} service backed by
 * a `SemVerVersionCache` instance from `semver-effect`.
 *
 * This layer wires up the cache storage but does not populate it with any
 * release data. Callers are responsible for loading releases after construction.
 * In normal usage you should prefer the higher-level cache strategy layers
 * instead of using this layer directly:
 * - {@link AutoBunCacheLive} — API with fallback to bundled defaults
 * - {@link FreshBunCacheLive} — API only, fails if unavailable
 * - {@link OfflineBunCacheLive} — bundled defaults only
 *
 * @see {@link BunReleaseCache}
 * @see {@link createRuntimeCache}
 * @internal
 */
export const BunReleaseCacheLive: Layer.Layer<BunReleaseCache, never, SemVerVersionCache> = Layer.effect(
	BunReleaseCache,
	createRuntimeCache<BunRelease>(),
);
