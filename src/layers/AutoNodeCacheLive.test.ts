import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { AutoNodeCacheLive } from "./AutoNodeCacheLive.js";

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
			inputs: [
				{ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" },
				{ version: "22.10.0", npm: "10.8.0", date: "2024-10-01" },
			],
		}),
});

const MockNodeScheduleFetcher = Layer.succeed(NodeScheduleFetcher, {
	fetch: () => Effect.succeed(mockSchedule),
});

const TestLayer = AutoNodeCacheLive.pipe(Layer.provide(Layer.merge(MockNodeVersionFetcher, MockNodeScheduleFetcher)));

describe("AutoNodeCacheLive", () => {
	it("populates cache from fetchers", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			const releases = yield* cache.releases();
			expect(releases.length).toBe(2);
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
