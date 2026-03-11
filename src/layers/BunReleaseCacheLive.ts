import { Layer } from "effect";
import type { VersionCache as SemVerVersionCache } from "semver-effect";
import type { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

export const BunReleaseCacheLive: Layer.Layer<BunReleaseCache, never, SemVerVersionCache> = Layer.effect(
	BunReleaseCache,
	createRuntimeCache<BunRelease>(),
);
