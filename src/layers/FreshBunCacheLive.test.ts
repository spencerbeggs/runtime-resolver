import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkError } from "../errors/NetworkError.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { FreshBunCacheLive } from "./FreshBunCacheLive.js";

const MockBunVersionFetcher = Layer.succeed(BunVersionFetcher, {
	fetch: () =>
		Effect.succeed({
			versions: [],
			inputs: [
				{ version: "1.2.3", date: "2025-01-15" },
				{ version: "1.1.0", date: "2025-01-01" },
			],
		}),
});

const SuccessLayer = FreshBunCacheLive.pipe(Layer.provide(MockBunVersionFetcher));

describe("FreshBunCacheLive", () => {
	it("populates cache from fetcher when API succeeds", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(2);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SuccessLayer)));
	});

	it("fails with FreshnessError when network is unavailable", async () => {
		const FailingFetcher = Layer.succeed(BunVersionFetcher, {
			fetch: () => Effect.fail(new NetworkError({ url: "https://example.com", message: "Network down" })),
		});
		const FailLayer = FreshBunCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			yield* BunReleaseCache;
		});
		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(FailLayer)));
		expect(result._tag).toBe("Failure");
	});
});
