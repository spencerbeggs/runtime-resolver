import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const TestLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

describe("BunReleaseCacheLive", () => {
	it("loads and queries releases", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* Effect.all([
				BunRelease.fromInput({ version: "1.2.0", date: "2025-01-01" }),
				BunRelease.fromInput({ version: "1.3.0", date: "2025-02-01" }),
			]);
			yield* cache.load(releases);
			const latest = yield* cache.latest();
			expect(latest.version.toString()).toBe("1.3.0");
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
