import { Effect, Layer } from "effect";
import * as semver from "semver";
import { describe, expect, it } from "vitest";
import { CacheError } from "../errors/CacheError.js";
import { NetworkError } from "../errors/NetworkError.js";
import { DenoResolverLive } from "../layers/DenoResolverLive.js";
import { DenoResolver } from "./DenoResolver.js";
import type { GitHubClientShape } from "./GitHubClient.js";
import { GitHubClient } from "./GitHubClient.js";
import type { VersionCacheShape } from "./VersionCache.js";
import { VersionCache } from "./VersionCache.js";

const fixtureTags = [
	{ name: "v2.7.3", zipball_url: "", tarball_url: "", commit: { sha: "a", url: "" }, node_id: "1" },
	{ name: "v2.7.2", zipball_url: "", tarball_url: "", commit: { sha: "b", url: "" }, node_id: "2" },
	{ name: "v2.6.0", zipball_url: "", tarball_url: "", commit: { sha: "c", url: "" }, node_id: "3" },
	{ name: "v2.1.0", zipball_url: "", tarball_url: "", commit: { sha: "d", url: "" }, node_id: "4" },
	{ name: "v1.40.0", zipball_url: "", tarball_url: "", commit: { sha: "e", url: "" }, node_id: "5" },
	{ name: "latest", zipball_url: "", tarball_url: "", commit: { sha: "f", url: "" }, node_id: "6" },
];

const makeTestGitHubClient = (overrides?: Partial<GitHubClientShape>): Layer.Layer<GitHubClient> =>
	Layer.succeed(GitHubClient, {
		listTags: () => Effect.succeed(fixtureTags),
		listReleases: () => Effect.succeed([]),
		getJson: () => Effect.succeed({} as never),
		...overrides,
	});

const makeTestCache = (): Layer.Layer<VersionCache> => {
	const store = new Map<string, unknown>();
	const shape: VersionCacheShape = {
		get: (runtime) =>
			Effect.gen(function* () {
				const entry = store.get(runtime);
				if (!entry) return yield* Effect.fail(new CacheError({ operation: "read", message: `No data for ${runtime}` }));
				return entry as never;
			}),
		set: (runtime, data) =>
			Effect.sync(() => {
				store.set(runtime, { data, source: "api" });
			}),
	};
	return Layer.succeed(VersionCache, shape);
};

const makeTestLayer = () => DenoResolverLive.pipe(Layer.provide(Layer.merge(makeTestGitHubClient(), makeTestCache())));

describe("DenoResolver service", () => {
	it("resolve returns all valid versions sorted descending", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve();
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.versions[0]).toBe("2.7.3");
		expect(result.latest).toBe("2.7.3");
		expect(result.source).toBe("api");
		// "latest" tag should be filtered out
		expect(result.versions).not.toContain("latest");
		expect(result.versions.length).toBe(5);
	});

	it("resolve filters by semver range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ semverRange: "^2.7.0" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.versions).toEqual(["2.7.3", "2.7.2"]);
		expect(result.latest).toBe("2.7.3");
	});

	it("resolve includes default version even outside range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({
				semverRange: "^2.7.0",
				defaultVersion: "1.40.0",
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.versions).toContain("1.40.0");
		expect(result.default).toBe("1.40.0");
	});

	it("resolve resolves default from range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ defaultVersion: "^2.6.0" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestLayer())));

		expect(result.default).toBe("2.7.3");
	});

	it("resolve fails with VersionNotFoundError for impossible range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ semverRange: ">=99.0.0" });
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(makeTestLayer())));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error._tag).toBe("VersionNotFoundError");
		}
	});

	it("fails with InvalidInputError for invalid semver range", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ semverRange: "not-a-range!!!" });
			}).pipe(Effect.provide(makeTestLayer()), Effect.flip),
		);
		expect(result._tag).toBe("InvalidInputError");
	});

	it("filters versions by increments 'latest'", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ increments: "latest" });
			}).pipe(Effect.provide(makeTestLayer())),
		);
		// Should have at most one version per major
		const majors = result.versions.map((v) => semver.major(v));
		expect(new Set(majors).size).toBe(majors.length);
		// Pin expected versions: latest per major from mock data
		expect(result.versions).toEqual(["2.7.3", "1.40.0"]);
	});

	it("filters versions by increments 'minor'", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ increments: "minor" });
			}).pipe(Effect.provide(makeTestLayer())),
		);
		// Should have at most one version per major.minor
		const minors = result.versions.map((v) => `${semver.major(v)}.${semver.minor(v)}`);
		expect(new Set(minors).size).toBe(minors.length);
		// Pin expected versions: latest per major.minor from mock data
		expect(result.versions).toEqual(["2.7.3", "2.6.0", "2.1.0", "1.40.0"]);
	});

	it("falls back to cache on network error", async () => {
		const failingClient = makeTestGitHubClient({
			listTags: () => Effect.fail(new NetworkError({ url: "test", message: "offline" })),
		});

		const cacheLayer = Layer.effect(
			VersionCache,
			Effect.sync(() => {
				const store = new Map<string, unknown>();
				store.set("deno", { data: { tags: fixtureTags }, source: "cache" });
				return {
					get: (runtime: string) =>
						Effect.gen(function* () {
							const entry = store.get(runtime);
							if (!entry) return yield* Effect.fail(new CacheError({ operation: "read", message: "miss" }));
							return entry as never;
						}),
					set: (_runtime: string, _data: unknown) => Effect.sync(() => {}),
				};
			}),
		);

		const layer = DenoResolverLive.pipe(Layer.provide(Layer.merge(failingClient, cacheLayer)));

		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve();
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));

		expect(result.versions.length).toBeGreaterThan(0);
		expect(result.latest).toBe("2.7.3");
		expect(result.source).toBe("cache");
	});
});
