import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkError } from "../errors/NetworkError.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { FreshNodeCacheLive } from "./FreshNodeCacheLive.js";

const mockSchedule: NodeScheduleData = {
	v22: {
		start: "2024-04-24",
		lts: "2024-10-29",
		maintenance: "2025-10-21",
		end: "2027-04-30",
		codename: "Jod",
	},
};

const MockNodeVersionFetcher = Layer.succeed(NodeVersionFetcher, {
	fetch: () =>
		Effect.succeed({
			versions: [],
			inputs: [{ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }],
		}),
});

const MockNodeScheduleFetcher = Layer.succeed(NodeScheduleFetcher, {
	fetch: () => Effect.succeed(mockSchedule),
});

const SuccessLayer = FreshNodeCacheLive.pipe(
	Layer.provide(Layer.merge(MockNodeVersionFetcher, MockNodeScheduleFetcher)),
);

describe("FreshNodeCacheLive", () => {
	it("populates cache from fetchers when API succeeds", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(1);
		});
		await Effect.runPromise(program.pipe(Effect.provide(SuccessLayer)));
	});

	it("fails with FreshnessError when network is unavailable", async () => {
		const FailingFetcher = Layer.succeed(NodeVersionFetcher, {
			fetch: () => Effect.fail(new NetworkError({ url: "https://example.com", message: "Network down" })),
		});
		const FailLayer = FreshNodeCacheLive.pipe(Layer.provide(Layer.merge(FailingFetcher, MockNodeScheduleFetcher)));
		const program = Effect.gen(function* () {
			yield* NodeReleaseCache;
		});
		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(FailLayer)));
		expect(result._tag).toBe("Failure");
	});
});
