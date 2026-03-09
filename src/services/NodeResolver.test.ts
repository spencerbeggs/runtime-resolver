import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { CacheError } from "../errors/CacheError.js";
import { NetworkError } from "../errors/NetworkError.js";
import { NodeResolverLive } from "../layers/NodeResolverLive.js";
import type { NodeDistVersion, NodeReleaseSchedule } from "../schemas/node.js";
import type { GitHubClientShape } from "./GitHubClient.js";
import { GitHubClient } from "./GitHubClient.js";
import { NodeResolver } from "./NodeResolver.js";
import type { VersionCacheShape } from "./VersionCache.js";
import { VersionCache } from "./VersionCache.js";

const fixtureVersions: ReadonlyArray<NodeDistVersion> = [
	{ version: "v24.0.0", date: "2025-04-22", files: [], lts: false, security: false },
	{ version: "v23.11.0", date: "2024-12-01", files: [], lts: false, security: false },
	{ version: "v22.11.0", date: "2024-11-15", files: [], lts: "Jod", security: false },
	{ version: "v22.10.0", date: "2024-10-01", files: [], lts: false, security: false },
	{ version: "v20.18.1", date: "2024-10-01", files: [], lts: "Iron", security: true },
	{ version: "v20.18.0", date: "2024-09-15", files: [], lts: "Iron", security: false },
	{ version: "v18.20.0", date: "2024-03-01", files: [], lts: "Hydrogen", security: false },
];

const fixtureSchedule: NodeReleaseSchedule = {
	v18: {
		start: "2022-04-19",
		lts: "2022-10-25",
		maintenance: "2023-10-18",
		end: "2025-04-30",
		codename: "Hydrogen",
	},
	v20: {
		start: "2023-04-18",
		lts: "2023-10-24",
		maintenance: "2024-10-22",
		end: "2026-04-30",
		codename: "Iron",
	},
	v22: {
		start: "2024-04-24",
		lts: "2024-10-29",
		maintenance: "2025-10-21",
		end: "2027-04-30",
		codename: "Jod",
	},
	v23: {
		start: "2024-10-16",
		end: "2025-06-01",
	},
	v24: {
		start: "2025-04-22",
		lts: "2025-10-28",
		maintenance: "2026-10-20",
		end: "2028-04-30",
	},
};

const makeTestGitHubClient = (overrides?: Partial<GitHubClientShape>): Layer.Layer<GitHubClient> =>
	Layer.succeed(GitHubClient, {
		listTags: () => Effect.succeed([]),
		listReleases: () => Effect.succeed([]),
		getJson: (_url, schema) => {
			if (_url.includes("dist/index.json")) {
				return schema.decode(fixtureVersions);
			}
			if (_url.includes("schedule.json")) {
				return schema.decode(fixtureSchedule);
			}
			return Effect.fail(new NetworkError({ url: _url, message: "unknown url" })) as never;
		},
		...overrides,
	});

const makeTestCache = (): Layer.Layer<VersionCache> => {
	const store = new Map<string, unknown>();
	const shape: VersionCacheShape = {
		get: (runtime) =>
			Effect.gen(function* () {
				const data = store.get(runtime);
				if (!data) {
					return yield* Effect.fail(new CacheError({ operation: "read", message: `No data for ${runtime}` }));
				}
				return data as never;
			}),
		set: (runtime, data) =>
			Effect.sync(() => {
				store.set(runtime, data);
			}),
	};
	return Layer.succeed(VersionCache, shape);
};

const testDate = new Date("2025-03-01");

const makeTestLayer = () => NodeResolverLive.pipe(Layer.provide(Layer.merge(makeTestGitHubClient(), makeTestCache())));

describe("NodeResolver service", () => {
	it("resolve returns current + active-lts versions by default", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			// Use a date where v23 is current and v22 is active-lts
			return yield* resolver.resolve({ date: testDate });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		// v24 not yet released at 2025-03-01, v23 is current, v22 is active-lts
		expect(result.versions).toContain("23.11.0");
		expect(result.versions).toContain("22.11.0");
		expect(result.versions).not.toContain("24.0.0");
		expect(result.latest).toBe("23.11.0");
	});

	it("resolve returns lts field", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				date: testDate,
				phases: ["current", "active-lts", "maintenance-lts"],
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.lts).toBeDefined();
	});

	it("resolve filters by semver range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				semverRange: ">=22.0.0 <23.0.0",
				phases: ["current", "active-lts"],
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.versions.every((v) => v.startsWith("22."))).toBe(true);
	});

	it("resolve includes default version even if outside filters", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				defaultVersion: "20.18.1",
				phases: ["current"],
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.versions).toContain("20.18.1");
		expect(result.default).toBe("20.18.1");
	});

	it("resolve resolves default version from range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				defaultVersion: "^22.0.0",
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.default).toBe("22.11.0");
	});

	it("resolve applies increment filtering", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				phases: ["active-lts", "maintenance-lts"],
				increments: "minor",
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		// Should have latest patch per minor
		expect(result.versions).toContain("20.18.1");
		expect(result.versions).not.toContain("20.18.0");
	});

	it("resolve fails with VersionNotFoundError for impossible range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				semverRange: ">=99.0.0",
				date: testDate,
			});
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(makeTestLayer())));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error._tag).toBe("VersionNotFoundError");
		}
	});

	it("resolveVersion returns exact version as-is", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolveVersion("22.11.0");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result).toBe("22.11.0");
	});

	it("resolveVersion resolves range to latest match", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolveVersion("^22.0.0");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result).toBe("22.11.0");
	});

	it("resolveVersion fails for no match", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolveVersion("^99.0.0");
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(makeTestLayer())));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error._tag).toBe("VersionNotFoundError");
		}
	});

	it("falls back to cache on network error", async () => {
		const failingClient = makeTestGitHubClient({
			getJson: () => Effect.fail(new NetworkError({ url: "test", message: "offline" })) as never,
		});

		// Pre-populate cache
		const cacheLayer = Layer.effect(
			VersionCache,
			Effect.sync(() => {
				const store = new Map<string, unknown>();
				store.set("node", { versions: fixtureVersions, schedule: fixtureSchedule });
				return {
					get: (runtime: string) =>
						Effect.gen(function* () {
							const data = store.get(runtime);
							if (!data) return yield* Effect.fail(new CacheError({ operation: "read", message: "miss" }));
							return data as never;
						}),
					set: (_runtime: string, _data: unknown) => Effect.sync(() => {}),
				};
			}),
		);

		const layer = NodeResolverLive.pipe(Layer.provide(Layer.merge(failingClient, cacheLayer)));

		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({ date: testDate });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

		expect(result.versions.length).toBeGreaterThan(0);
		expect(result.latest).toBeDefined();
	});
});
