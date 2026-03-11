import { Layer } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

export const DenoReleaseCacheLive: Layer.Layer<DenoReleaseCache, never, SemVerVersionCache> = Layer.effect(
	DenoReleaseCache,
	createRuntimeCache<DenoRelease>(),
);
