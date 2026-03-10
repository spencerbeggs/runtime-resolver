import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubTokenAuth, GitHubTokenAuthFromToken } from "./GitHubTokenAuth.js";

describe("GitHubTokenAuth", () => {
	beforeEach(() => {
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
		vi.stubEnv("GITHUB_TOKEN", "");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("creates an authenticated Octokit when GITHUB_PERSONAL_ACCESS_TOKEN is set", async () => {
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_pat_test123");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubTokenAuth)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});

	it("falls back to GITHUB_TOKEN when GITHUB_PERSONAL_ACCESS_TOKEN is not set", async () => {
		vi.stubEnv("GITHUB_TOKEN", "ghp_token_fallback");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubTokenAuth)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});

	it("creates an unauthenticated Octokit when no env vars are set", async () => {
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubTokenAuth)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});
});

describe("GitHubTokenAuthFromToken", () => {
	it("creates an authenticated Octokit with the given token", async () => {
		const layer = GitHubTokenAuthFromToken("ghp_direct_token");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(layer)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});
});
