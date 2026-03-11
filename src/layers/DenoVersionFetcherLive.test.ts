import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { DenoVersionFetcherLive } from "./DenoVersionFetcherLive.js";

const mockReleases = [
	{ tag_name: "v2.7.3", name: "Deno 2.7.3", draft: false, prerelease: false, published_at: "2025-03-01" },
	{ tag_name: "v1.40.0", name: "Deno 1.40.0", draft: false, prerelease: false, published_at: "2024-01-15" },
	{ tag_name: "latest", name: "Latest", draft: false, prerelease: false, published_at: "2025-03-10" },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
	listTags: () => Effect.succeed([]),
	listReleases: () => Effect.succeed(mockReleases),
	getJson: () => Effect.succeed(undefined) as never,
});

const TestLayer = DenoVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("DenoVersionFetcherLive", () => {
	it("normalizes deno release tags, skips invalid, and includes dates", async () => {
		const program = Effect.gen(function* () {
			const fetcher = yield* DenoVersionFetcher;
			const { versions, inputs } = yield* fetcher.fetch();
			expect(versions.length).toBe(2);
			expect(inputs[0].version).toBe("2.7.3");
			expect(inputs[0].date).toBe("2025-03-01");
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
