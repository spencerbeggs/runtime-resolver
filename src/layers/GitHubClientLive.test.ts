import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubClientLive } from "./GitHubClientLive.js";

describe("GitHubClientLive", () => {
	describe("mapOctokitError", () => {
		it("maps 401 to AuthenticationError", async () => {
			const mockOctokit = {
				rest: {
					repos: {
						listTags: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
						listReleases: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
					},
				},
			};
			const mockLayer = Layer.succeed(OctokitInstance, mockOctokit);
			const testLayer = GitHubClientLive.pipe(Layer.provide(mockLayer));

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			expect(exit._tag).toBe("Failure");

			if (exit._tag === "Failure") {
				const error = exit.cause;
				const failure = error as unknown as { _tag: string; error: { _tag: string; method: string } };
				expect(failure._tag).toBe("Fail");
				expect(failure.error._tag).toBe("AuthenticationError");
				expect(failure.error.method).toBe("token");
			}
		});
	});
});
