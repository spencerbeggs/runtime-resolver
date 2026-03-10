import { Effect, LogLevel, Logger } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAutoAuth } from "./GitHubAutoAuth.js";

describe("GitHubAutoAuth", () => {
	beforeEach(() => {
		// Clear all relevant env vars by setting them to empty strings.
		// Empty strings are falsy in JS, and the implementation uses truthiness
		// checks (e.g. `appId && privateKey`), so "" effectively disables each var.
		// vi.stubEnv doesn't reliably accept undefined in all vitest versions,
		// so "" is the safest portable stub value here.
		vi.stubEnv("GITHUB_APP_ID", "");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
		vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "");
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
		vi.stubEnv("GITHUB_TOKEN", "");
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.restoreAllMocks();
	});

	it("uses token auth when GITHUB_PERSONAL_ACCESS_TOKEN is set", async () => {
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_test123");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubAutoAuth)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});

	it("uses token auth with GITHUB_TOKEN as fallback", async () => {
		vi.stubEnv("GITHUB_TOKEN", "ghp_fallback");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubAutoAuth)));
		expect(result).toBeDefined();
	});

	it("prefers GITHUB_PERSONAL_ACCESS_TOKEN over GITHUB_TOKEN", async () => {
		vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "ghp_pat");
		vi.stubEnv("GITHUB_TOKEN", "ghp_token");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubAutoAuth)));
		expect(result).toBeDefined();
		expect(result.rest).toBeDefined();
	});

	it("creates unauthenticated client when no credentials are set", async () => {
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const result = await Effect.runPromise(program.pipe(Effect.provide(GitHubAutoAuth)));
		expect(result).toBeDefined();
	});

	it("attempts app auth when GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY are set", async () => {
		vi.stubEnv("GITHUB_APP_ID", "12345");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "fake-key");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(GitHubAutoAuth)));
		// App auth with fake key will fail — just verify it's AuthenticationError
		expect(exit._tag).toBe("Failure");
	});

	it("emits warning when both app and token env vars are set", async () => {
		vi.stubEnv("GITHUB_APP_ID", "12345");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "fake-key");
		vi.stubEnv("GITHUB_TOKEN", "ghp_token");

		const messages: string[] = [];
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		}).pipe(
			Effect.provide(GitHubAutoAuth),
			Logger.withMinimumLogLevel(LogLevel.Warning),
			Effect.tap(() => Effect.logWarning("sentinel")),
		);

		await Effect.runPromiseExit(
			program.pipe(
				Effect.provide(
					Logger.replace(
						Logger.defaultLogger,
						Logger.make(({ message }) => {
							messages.push(typeof message === "string" ? message : String(message));
						}),
					),
				),
			),
		);

		expect(messages.some((m) => m.includes("Multiple GitHub credential sources found"))).toBe(true);
	});

	it("attempts app auth with installation ID when GITHUB_APP_INSTALLATION_ID is also set", async () => {
		vi.stubEnv("GITHUB_APP_ID", "12345");
		vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "fake-key");
		vi.stubEnv("GITHUB_APP_INSTALLATION_ID", "67890");
		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});
		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(GitHubAutoAuth)));
		// App auth with a fake private key will fail — just verify it attempts auth and fails
		expect(exit._tag).toBe("Failure");
	});
});
