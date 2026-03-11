import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "../schemas/bun-release.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));

const makeBunReleases = () =>
	Effect.all([
		BunRelease.fromInput({ version: "1.2.3", date: "2025-01-15" }),
		BunRelease.fromInput({ version: "1.1.0", date: "2025-01-01" }),
		BunRelease.fromInput({ version: "1.3.0", date: "2025-02-01" }),
		BunRelease.fromInput({ version: "0.9.0", date: "2024-12-01" }),
	]);

describe("RuntimeCacheLive", () => {
	it("loads releases and returns them", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const all = yield* cache.releases();
			expect(all.length).toBe(4);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});

	it("resolves range to best match", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const result = yield* cache.resolve("^1.0.0");
			expect(result.version.toString()).toBe("1.3.0");
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});

	it("filters by range", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const filtered = yield* cache.filter("^1.0.0");
			expect(filtered.length).toBe(3);
			expect(filtered.every((r) => r.version.major === 1)).toBe(true);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});

	it("returns latest", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const latest = yield* cache.latest();
			expect(latest.version.toString()).toBe("1.3.0");
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});

	it("returns latestByMajor", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const byMajor = yield* cache.latestByMajor();
			expect(byMajor.length).toBe(2); // major 0 and major 1
			const versions = byMajor.map((r) => r.version.toString());
			expect(versions).toContain("1.3.0");
			expect(versions).toContain("0.9.0");
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});

	it("returns latestByMinor", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* createRuntimeCache<BunRelease>();
			const releases = yield* makeBunReleases();
			yield* cache.load(releases);
			const byMinor = yield* cache.latestByMinor();
			// 0.9, 1.1, 1.2, 1.3 — each has one version
			expect(byMinor.length).toBe(4);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
	});
});
