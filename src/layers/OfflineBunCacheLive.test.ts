import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { OfflineBunCacheLive } from "./OfflineBunCacheLive.js";

describe("OfflineBunCacheLive", () => {
	it("populates cache from bundled defaults", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(OfflineBunCacheLive)));
	});
});
