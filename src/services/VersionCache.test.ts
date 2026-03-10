import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { CacheError } from "../errors/CacheError.js";
import { VersionCacheLive } from "../layers/VersionCacheLive.js";
import type { CachedNodeData, CachedTagData } from "../schemas/cache.js";
import type { Source } from "../schemas/common.js";
import type { CachedData, VersionCacheShape } from "./VersionCache.js";
import { VersionCache } from "./VersionCache.js";

const mockNodeData: CachedNodeData = {
	versions: [
		{
			version: "v22.0.0",
			date: "2024-04-24",
			files: ["headers"],
			lts: false,
			security: false,
		},
	],
	schedule: {
		v22: {
			start: "2024-04-24",
			lts: "2024-10-29",
			maintenance: "2025-10-21",
			end: "2027-04-30",
		},
	},
};

const mockBunData: CachedTagData = {
	tags: [
		{
			name: "bun-v1.2.0",
			zipball_url: "https://example.com/zipball",
			tarball_url: "https://example.com/tarball",
			commit: { sha: "abc", url: "https://example.com" },
			node_id: "TAG_abc",
		},
	],
};

const makeTestCache = (): Layer.Layer<VersionCache> => {
	const store = new Map<string, { data: CachedData; source: Source }>();
	store.set("node", { data: mockNodeData, source: "cache" });
	store.set("bun", { data: mockBunData, source: "cache" });

	const shape: VersionCacheShape = {
		get: (runtime) =>
			Effect.gen(function* () {
				const entry = store.get(runtime);
				if (!entry) {
					return yield* Effect.fail(new CacheError({ operation: "read", message: `No data for ${runtime}` }));
				}
				return entry;
			}),
		set: (runtime, data) =>
			Effect.sync(() => {
				store.set(runtime, { data, source: "api" });
			}),
	};

	return Layer.succeed(VersionCache, shape);
};

describe("VersionCache service", () => {
	it("get returns cached node data with source", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("node");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestCache())));

		expect(result.data).toEqual(mockNodeData);
		expect(result.source).toBe("cache");
	});

	it("get returns cached bun data with source", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("bun");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestCache())));

		expect(result.data).toEqual(mockBunData);
		expect(result.source).toBe("cache");
	});

	it("get fails with CacheError for missing runtime", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("deno");
		});

		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(makeTestCache())));

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure" && result.cause._tag === "Fail") {
			expect(result.cause.error._tag).toBe("CacheError");
			expect((result.cause.error as CacheError).operation).toBe("read");
		}
	});

	it("set then get returns updated data with source 'api'", async () => {
		const newDenoData: CachedTagData = {
			tags: [
				{
					name: "v2.0.0",
					zipball_url: "https://example.com/zipball",
					tarball_url: "https://example.com/tarball",
					commit: { sha: "xyz", url: "https://example.com" },
					node_id: "TAG_xyz",
				},
			],
		};

		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			yield* cache.set("deno", newDenoData);
			return yield* cache.get("deno");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestCache())));

		expect(result.data).toEqual(newDenoData);
		expect(result.source).toBe("api");
	});

	it("CacheError has correct _tag", () => {
		const err = new CacheError({ operation: "read", message: "test" });
		expect(err._tag).toBe("CacheError");
		expect(err.operation).toBe("read");
	});
});

describe("VersionCacheLive", () => {
	it("returns fallback data with source 'cache'", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("node");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(VersionCacheLive)));

		expect(result.source).toBe("cache");
		expect(result.data).toBeDefined();
		const nodeData = result.data as CachedNodeData;
		expect(nodeData.versions).toBeDefined();
		expect(nodeData.schedule).toBeDefined();
	});

	it("returns source 'api' after set", async () => {
		const newData: CachedTagData = {
			tags: [
				{
					name: "bun-v1.3.0",
					zipball_url: "https://example.com/zipball",
					tarball_url: "https://example.com/tarball",
					commit: { sha: "def", url: "https://example.com" },
					node_id: "TAG_def",
				},
			],
		};

		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			yield* cache.set("bun", newData);
			return yield* cache.get("bun");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(VersionCacheLive)));

		expect(result.source).toBe("api");
		expect(result.data).toEqual(newData);
	});

	it("caches fallback data on subsequent gets", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			const first = yield* cache.get("deno");
			const second = yield* cache.get("deno");
			return { first, second };
		});

		const { first, second } = await Effect.runPromise(program.pipe(Effect.provide(VersionCacheLive)));

		expect(first.source).toBe("cache");
		expect(second.source).toBe("cache");
		expect(first.data).toBe(second.data);
	});
});
