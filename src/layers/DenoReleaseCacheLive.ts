import { Layer } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

/**
 * Low-level layer that constructs the {@link DenoReleaseCache} service backed by
 * a `SemVerVersionCache` instance from `semver-effect`.
 *
 * This layer wires up the cache storage but does not populate it with any
 * release data. Callers are responsible for loading releases after construction.
 * In normal usage you should prefer the higher-level cache strategy layers
 * instead of using this layer directly:
 * - {@link AutoDenoCacheLive} — API with fallback to bundled defaults
 * - {@link FreshDenoCacheLive} — API only, fails if unavailable
 * - {@link OfflineDenoCacheLive} — bundled defaults only
 *
 * @see {@link DenoReleaseCache}
 * @see {@link createRuntimeCache}
 * @internal
 */
export const DenoReleaseCacheLive: Layer.Layer<DenoReleaseCache, never, SemVerVersionCache> = Layer.effect(
	DenoReleaseCache,
	createRuntimeCache<DenoRelease>(),
);
