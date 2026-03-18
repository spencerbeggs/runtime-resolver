import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkError } from "../errors/NetworkError.js";
import { ParseError } from "../errors/ParseError.js";
import { RateLimitError } from "../errors/RateLimitError.js";
import { GitHubClient } from "./GitHubClient.js";

const mockTags = [
	{
		name: "v1.2.3",
		zipball_url: "https://example.com/zipball/v1.2.3",
		tarball_url: "https://example.com/tarball/v1.2.3",
		commit: { sha: "abc123", url: "https://example.com/commits/abc123" },
		node_id: "TAG_abc123",
	},
	{
		name: "v1.2.2",
		zipball_url: "https://example.com/zipball/v1.2.2",
		tarball_url: "https://example.com/tarball/v1.2.2",
		commit: { sha: "def456", url: "https://example.com/commits/def456" },
		node_id: "TAG_def456",
	},
];

const mockReleases = [
	{
		tag_name: "v1.2.3",
		name: "Release 1.2.3",
		draft: false,
		prerelease: false,
		published_at: "2024-01-15T00:00:00Z",
	},
];

const makeTestClient = (overrides?: Partial<typeof GitHubClient.Service>): Layer.Layer<GitHubClient> =>
	Layer.succeed(GitHubClient, {
		listTags: () => Effect.succeed(mockTags),
		listReleases: () => Effect.succeed(mockReleases),
		getJson: () => Effect.succeed({} as never),
		...overrides,
	});

describe("GitHubClient service", () => {
	it("listTags returns mock tag data", async () => {
		const program = Effect.gen(function* () {
			const client = yield* GitHubClient;
			return yield* client.listTags("owner", "repo");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestClient())));

		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("v1.2.3");
		expect(result[1].commit.sha).toBe("def456");
	});

	it("listReleases returns mock release data", async () => {
		const program = Effect.gen(function* () {
			const client = yield* GitHubClient;
			return yield* client.listReleases("owner", "repo");
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(makeTestClient())));

		expect(result).toHaveLength(1);
		expect(result[0].tag_name).toBe("v1.2.3");
		expect(result[0].prerelease).toBe(false);
	});

	it("listTags propagates NetworkError", async () => {
		const failingClient = makeTestClient({
			listTags: () => Effect.fail(new NetworkError({ url: "test", message: "connection refused" })),
		});

		const program = Effect.gen(function* () {
			const client = yield* GitHubClient;
			return yield* client.listTags("owner", "repo");
		});

		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(failingClient)));

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure") {
			const error = result.cause;
			expect(error._tag).toBe("Fail");
			if (error._tag === "Fail") {
				expect(error.error._tag).toBe("NetworkError");
			}
		}
	});

	it("listTags propagates RateLimitError", async () => {
		const rateLimitedClient = makeTestClient({
			listTags: () =>
				Effect.fail(
					new RateLimitError({
						limit: 60,
						remaining: 0,
						message: "rate limited",
					}),
				),
		});

		const program = Effect.gen(function* () {
			const client = yield* GitHubClient;
			return yield* client.listTags("owner", "repo");
		});

		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(rateLimitedClient)));

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure" && result.cause._tag === "Fail") {
			expect(result.cause.error._tag).toBe("RateLimitError");
			expect((result.cause.error as RateLimitError).limit).toBe(60);
		}
	});

	it("getJson propagates ParseError", async () => {
		const parseFailClient = makeTestClient({
			getJson: () => Effect.fail(new ParseError({ source: "test-url", message: "invalid json" })),
		});

		const program = Effect.gen(function* () {
			const client = yield* GitHubClient;
			return yield* client.getJson("test-url", { decode: () => Effect.succeed({}) });
		});

		const result = await Effect.runPromiseExit(program.pipe(Effect.provide(parseFailClient)));

		expect(result._tag).toBe("Failure");
		if (result._tag === "Failure" && result.cause._tag === "Fail") {
			expect(result.cause.error._tag).toBe("ParseError");
		}
	});

	it("errors are discriminable via _tag", () => {
		const networkErr = new NetworkError({ url: "x", message: "fail" });
		const parseErr = new ParseError({ source: "x", message: "fail" });
		const rateErr = new RateLimitError({ limit: 0, remaining: 0, message: "fail" });

		expect(networkErr._tag).toBe("NetworkError");
		expect(parseErr._tag).toBe("ParseError");
		expect(rateErr._tag).toBe("RateLimitError");
	});
});
