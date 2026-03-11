import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeVersionFetcherLive } from "./NodeVersionFetcherLive.js";

const mockVersions = [
	{ version: "v22.11.0", date: "2024-11-15", files: [], npm: "10.9.0", lts: "Jod", security: false },
	{ version: "v22.10.0", date: "2024-10-01", files: [], lts: false, security: false },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
	listTags: () => Effect.succeed([]),
	listReleases: () => Effect.succeed([]),
	getJson: (_url, schema) => schema.decode(mockVersions),
});

const TestLayer = NodeVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("NodeVersionFetcherLive", () => {
	it("fetches and parses node versions", async () => {
		const program = Effect.gen(function* () {
			const fetcher = yield* NodeVersionFetcher;
			const { versions, inputs } = yield* fetcher.fetch();
			expect(versions.length).toBe(2);
			expect(inputs.length).toBe(2);
			expect(inputs[0].version).toBe("22.11.0");
			expect(inputs[0].npm).toBe("10.9.0");
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
