import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { NetworkError } from "../errors/NetworkError.js";
import { ParseError } from "../errors/ParseError.js";
import { RateLimitError } from "../errors/RateLimitError.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { AutoDenoCacheLive } from "./AutoDenoCacheLive.js";

const MockDenoVersionFetcher = Layer.succeed(DenoVersionFetcher, {
	fetch: () =>
		Effect.succeed({
			versions: [],
			inputs: [
				{ version: "2.3.2", date: "2025-05-16" },
				{ version: "2.2.0", date: "2025-02-19" },
			],
		}),
});

const TestLayer = AutoDenoCacheLive.pipe(Layer.provide(MockDenoVersionFetcher));

describe("AutoDenoCacheLive", () => {
	it("populates cache from fetcher", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(2);
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});

	it("falls back to defaults on NetworkError", async () => {
		const FailingFetcher = Layer.succeed(DenoVersionFetcher, {
			fetch: () => Effect.fail(new NetworkError({ url: "https://example.com", message: "down" })),
		});
		const layer = AutoDenoCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on AuthenticationError", async () => {
		const FailingFetcher = Layer.succeed(DenoVersionFetcher, {
			fetch: () => Effect.fail(new AuthenticationError({ method: "token", message: "bad token" })),
		});
		const layer = AutoDenoCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on ParseError", async () => {
		const FailingFetcher = Layer.succeed(DenoVersionFetcher, {
			fetch: () => Effect.fail(new ParseError({ message: "bad data", source: "test" })),
		});
		const layer = AutoDenoCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});

	it("falls back to defaults on RateLimitError", async () => {
		const FailingFetcher = Layer.succeed(DenoVersionFetcher, {
			fetch: () => Effect.fail(new RateLimitError({ message: "rate limited", limit: 60, remaining: 0 })),
		});
		const layer = AutoDenoCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBeGreaterThan(0);
		});
		await Effect.runPromise(program.pipe(Effect.provide(layer)));
	});
});
