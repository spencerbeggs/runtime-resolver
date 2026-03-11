import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { OfflineDenoCacheLive } from "./OfflineDenoCacheLive.js";

describe("OfflineDenoCacheLive", () => {
	it("populates cache from bundled defaults", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(OfflineDenoCacheLive)));
	});
});
