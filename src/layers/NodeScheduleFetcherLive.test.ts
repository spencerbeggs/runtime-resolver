import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeScheduleFetcherLive } from "./NodeScheduleFetcherLive.js";

const mockSchedule = {
	v22: { start: "2024-04-24", lts: "2024-10-29", end: "2027-04-30", codename: "Jod" },
};

const MockGitHubClient = Layer.succeed(GitHubClient, {
	listTags: () => Effect.succeed([]),
	listReleases: () => Effect.succeed([]),
	getJson: (_url, schema) => schema.decode(mockSchedule),
});

const TestLayer = NodeScheduleFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("NodeScheduleFetcherLive", () => {
	it("fetches and returns schedule data", async () => {
		const program = Effect.gen(function* () {
			const fetcher = yield* NodeScheduleFetcher;
			const data = yield* fetcher.fetch();
			expect(data.v22).toBeDefined();
			expect(data.v22.codename).toBe("Jod");
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
