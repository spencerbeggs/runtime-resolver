import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { DenoReleaseCacheLive } from "../layers/DenoReleaseCacheLive.js";
import { DenoResolverLive } from "../layers/DenoResolverLive.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoResolver } from "./DenoResolver.js";

const denoInputs = [
	{ version: "2.7.3", date: "2025-02-15" },
	{ version: "2.7.2", date: "2025-02-10" },
	{ version: "2.6.0", date: "2025-01-01" },
	{ version: "2.1.0", date: "2024-10-01" },
	{ version: "1.40.0", date: "2024-08-01" },
];

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));
const CacheLayer = BaseCacheLayer.pipe(
	Layer.tap((ctx) =>
		Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* Effect.all(denoInputs.map((i) => DenoRelease.fromInput(i)));
			yield* cache.load(releases);
		}).pipe(Effect.provide(ctx)),
	),
);
const TestLayer = DenoResolverLive.pipe(Layer.provide(CacheLayer));

describe("DenoResolver service", () => {
	it("resolve returns versions sorted descending", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ increments: "patch" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.versions[0]).toBe("2.7.3");
		expect(result.latest).toBe("2.7.3");
		expect(result.source).toBe("api");
		expect(result.versions.length).toBe(5);
	});

	it("resolve filters by semver range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ semverRange: "^2.7.0", increments: "patch" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.versions).toEqual(["2.7.3", "2.7.2"]);
		expect(result.latest).toBe("2.7.3");
	});

	it("resolve includes default version", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({
				semverRange: "^2.7.0",
				defaultVersion: "1.40.0",
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.default).toBe("1.40.0");
	});

	it("resolve resolves default from range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve({ defaultVersion: "^2.6.0", increments: "patch" });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.default).toBe("2.7.3");
	});

	it("resolve fails with VersionNotFoundError for impossible range", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ semverRange: ">=99.0.0" });
			}).pipe(Effect.provide(TestLayer), Effect.flip),
		);
		expect(result._tag).toBe("VersionNotFoundError");
	});

	it("resolve fails with VersionNotFoundError for invalid semver range", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ semverRange: "not-a-range!!!" });
			}).pipe(Effect.provide(TestLayer), Effect.flip),
		);
		// Invalid range causes cache.filter to fail → caught → empty list → VersionNotFoundError
		expect(result._tag).toBe("VersionNotFoundError");
	});

	it("filters versions by increments 'latest'", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ increments: "latest" });
			}).pipe(Effect.provide(TestLayer)),
		);
		// Should have at most one version per major
		const majors = result.versions.map((v) => Number.parseInt(v.split(".")[0], 10));
		expect(new Set(majors).size).toBe(majors.length);
		expect(result.versions).toEqual(["2.7.3", "1.40.0"]);
	});

	it("filters versions by increments 'minor'", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* DenoResolver;
				return yield* resolver.resolve({ increments: "minor" });
			}).pipe(Effect.provide(TestLayer)),
		);
		// Should have at most one version per major.minor
		const minors = result.versions.map((v) => {
			const parts = v.split(".");
			return `${parts[0]}.${parts[1]}`;
		});
		expect(new Set(minors).size).toBe(minors.length);
		expect(result.versions).toEqual(["2.7.3", "2.6.0", "2.1.0", "1.40.0"]);
	});
});
