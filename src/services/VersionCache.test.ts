import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { CacheError } from "../errors/CacheError.js";
import type { CachedNodeData, CachedTagData } from "../schemas/cache.js";
import type { VersionCacheShape } from "./VersionCache.js";
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
	const store = new Map<string, CachedNodeData | CachedTagData>();
	store.set("node", mockNodeData);
	store.set("bun", mockBunData);

	const shape: VersionCacheShape = {
		get: (runtime) =>
			Effect.gen(function* () {
				const data = store.get(runtime);
				if (!data) {
					return yield* Effect.fail(new CacheError({ operation: "read", message: `No data for ${runtime}` }));
				}
				return data;
			}),
		set: (runtime, data) =>
			Effect.sync(() => {
				store.set(runtime, data);
			}),
	};

	return Layer.succeed(VersionCache, shape);
};

describe("VersionCache service", () => {
	it("get returns cached node data", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("node");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestCache())));

		expect(result).toEqual(mockNodeData);
	});

	it("get returns cached bun data", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* VersionCache;
			return yield* cache.get("bun");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestCache())));

		expect(result).toEqual(mockBunData);
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

	it("set then get returns updated data", async () => {
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

		expect(result).toEqual(newDenoData);
	});

	it("CacheError has correct _tag", () => {
		const err = new CacheError({ operation: "read", message: "test" });
		expect(err._tag).toBe("CacheError");
		expect(err.operation).toBe("read");
	});
});
