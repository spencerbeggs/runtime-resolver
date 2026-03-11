import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { OfflineNodeCacheLive } from "./OfflineNodeCacheLive.js";

describe("OfflineNodeCacheLive", () => {
	it("populates cache from bundled defaults", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(OfflineNodeCacheLive)));
	});
});
