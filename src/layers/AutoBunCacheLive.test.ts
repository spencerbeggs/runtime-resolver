import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { AutoBunCacheLive } from "./AutoBunCacheLive.js";

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

const TestLayer = AutoBunCacheLive.pipe(Layer.provide(MockBunVersionFetcher));

describe("AutoBunCacheLive", () => {
	it("populates cache from fetcher", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(2);
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
