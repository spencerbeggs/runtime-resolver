import type { Effect } from "effect";
import { Context } from "effect";
import type { CacheError } from "../errors/CacheError.js";
import type { CachedNodeData, CachedTagData } from "../schemas/cache.js";
import type { Runtime, Source } from "../schemas/common.js";

export type CachedData = CachedNodeData | CachedTagData;

export interface VersionCacheShape {
	readonly get: (runtime: Runtime) => Effect.Effect<{ data: CachedData; source: Source }, CacheError>;
	readonly set: (runtime: Runtime, data: CachedData) => Effect.Effect<void, CacheError>;
}

export class VersionCache extends Context.Tag("VersionCache")<VersionCache, VersionCacheShape>() {}
