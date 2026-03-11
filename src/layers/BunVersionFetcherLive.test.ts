import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { BunVersionFetcherLive } from "./BunVersionFetcherLive.js";

const mockReleases = [
	{ tag_name: "bun-v1.2.3", name: "Bun v1.2.3", draft: false, prerelease: false, published_at: "2025-01-15" },
	{ tag_name: "v0.1.0", name: "v0.1.0", draft: false, prerelease: false, published_at: "2024-06-01" },
	{ tag_name: "canary", name: "Canary", draft: false, prerelease: true, published_at: "2025-02-01" },
	{ tag_name: "bun-v1.3.0-beta", name: "Beta", draft: true, prerelease: false, published_at: "2025-02-01" },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
	listTags: () => Effect.succeed([]),
	listReleases: () => Effect.succeed(mockReleases),
	getJson: () => Effect.succeed(undefined) as never,
});

const TestLayer = BunVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("BunVersionFetcherLive", () => {
	it("normalizes bun release tags, skips drafts/prereleases/invalid, and includes dates", async () => {
		const program = Effect.gen(function* () {
			const fetcher = yield* BunVersionFetcher;
			const { versions, inputs } = yield* fetcher.fetch();
			expect(versions.length).toBe(2);
			expect(inputs.length).toBe(2);
			expect(inputs[0].version).toBe("1.2.3");
			expect(inputs[0].date).toBe("2025-01-15");
			expect(inputs[1].version).toBe("0.1.0");
			expect(inputs[1].date).toBe("2024-06-01");
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
