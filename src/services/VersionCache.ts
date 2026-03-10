import type { Effect } from "effect";
import { Context } from "effect";
import type { CacheError } from "../errors/CacheError.js";
import type { CachedNodeData, CachedTagData } from "../schemas/cache.js";
import type { Runtime, Source } from "../schemas/common.js";

export type CachedData = CachedNodeData | CachedTagData;

/**
 * Service interface for version data caching.
 */
export interface VersionCache {
	readonly get: (runtime: Runtime) => Effect.Effect<{ data: CachedData; source: Source }, CacheError>;
	readonly set: (runtime: Runtime, data: CachedData) => Effect.Effect<void, CacheError>;
}

/** @deprecated Use {@link VersionCache} instead. */
export type VersionCacheShape = VersionCache;

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const VersionCache = Context.GenericTag<VersionCache>("VersionCache");
