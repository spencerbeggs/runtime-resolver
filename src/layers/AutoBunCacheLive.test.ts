import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { NetworkError } from "../errors/NetworkError.js";
import { ParseError } from "../errors/ParseError.js";
import { RateLimitError } from "../errors/RateLimitError.js";
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

	it("falls back to defaults on NetworkError", async () => {
		const FailingFetcher = Layer.succeed(BunVersionFetcher, {
			fetch: () => Effect.fail(new NetworkError({ url: "https://example.com", message: "down" })),
		});
		const layer = AutoBunCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on AuthenticationError", async () => {
		const FailingFetcher = Layer.succeed(BunVersionFetcher, {
			fetch: () => Effect.fail(new AuthenticationError({ method: "token", message: "bad token" })),
		});
		const layer = AutoBunCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on ParseError", async () => {
		const FailingFetcher = Layer.succeed(BunVersionFetcher, {
			fetch: () => Effect.fail(new ParseError({ message: "bad data", source: "test" })),
		});
		const layer = AutoBunCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on RateLimitError", async () => {
		const FailingFetcher = Layer.succeed(BunVersionFetcher, {
			fetch: () => Effect.fail(new RateLimitError({ message: "rate limited", limit: 60, remaining: 0 })),
		});
		const layer = AutoBunCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* BunReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});
});
