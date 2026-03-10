import { Effect, Layer } from "effect";
import { bunDefaultTags } from "../data/bun-defaults.js";
import { denoDefaultTags } from "../data/deno-defaults.js";
import { nodeDefaultSchedule, nodeDefaultVersions } from "../data/node-defaults.js";
import { CacheError } from "../errors/CacheError.js";
import type { CachedNodeData, CachedTagData } from "../schemas/cache.js";
import type { Runtime, Source } from "../schemas/common.js";
import type { CachedData } from "../services/VersionCache.js";
import { VersionCache } from "../services/VersionCache.js";

const fallbackData: Record<Runtime, CachedData> = {
	node: { versions: [...nodeDefaultVersions], schedule: { ...nodeDefaultSchedule } } satisfies CachedNodeData,
	bun: { tags: [...bunDefaultTags] } satisfies CachedTagData,
	deno: { tags: [...denoDefaultTags] } satisfies CachedTagData,
};

export const VersionCacheLive: Layer.Layer<VersionCache> = Layer.sync(VersionCache, () => {
	const memoryCache = new Map<Runtime, { data: CachedData; source: Source }>();

	return {
		get: (runtime: Runtime) =>
			Effect.gen(function* () {
				const cached = memoryCache.get(runtime);
				if (cached) return cached;

				const data = fallbackData[runtime];
				if (!data) {
					return yield* Effect.fail(
						new CacheError({
							operation: "read",
							message: `No cached data found for runtime: ${runtime}`,
						}),
					);
				}

				const entry = { data, source: "cache" as const };
				memoryCache.set(runtime, entry);
				return entry;
			}),

		set: (runtime: Runtime, data: CachedData) =>
			Effect.sync(() => {
				memoryCache.set(runtime, { data, source: "api" as const });
			}),
	};
});
