import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkError } from "../errors/NetworkError.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { FreshDenoCacheLive } from "./FreshDenoCacheLive.js";

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

const SuccessLayer = FreshDenoCacheLive.pipe(Layer.provide(MockDenoVersionFetcher));

describe("FreshDenoCacheLive", () => {
	it("populates cache from fetcher when API succeeds", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* DenoReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(2);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SuccessLayer)));
	});

	it("fails with FreshnessError when network is unavailable", async () => {
		const FailingFetcher = Layer.succeed(DenoVersionFetcher, {
			fetch: () => Effect.fail(new NetworkError({ url: "https://example.com", message: "Network down" })),
		});
		const FailLayer = FreshDenoCacheLive.pipe(Layer.provide(FailingFetcher));
		const program = Effect.gen(function* () {
			yield* DenoReleaseCache;
		});
		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(FailLayer)));
		expect(result._tag).toBe("Failure");
	});
});
