import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

vi.mock("@octokit/auth-app", () => ({
	createAppAuth: vi.fn(),
}));

import { createAppAuth } from "@octokit/auth-app";

const mockedCreateAppAuth = vi.mocked(createAppAuth);

describe("GitHubAppAuth", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("produces AuthenticationError on invalid credentials", async () => {
		mockedCreateAppAuth.mockImplementation(() => {
			throw new Error("Invalid private key");
		});

		const layer = GitHubAppAuth({
			appId: "invalid",
			privateKey: "not-a-real-key",
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Failure");

		if (exit._tag === "Failure") {
			const failure = exit.cause as { _tag: string; error: { _tag: string; method: string; message: string } };
			expect(failure._tag).toBe("Fail");
			expect(failure.error._tag).toBe("AuthenticationError");
			expect(failure.error.method).toBe("app");
			expect(failure.error.message).toBe("Invalid private key");
		}
	});

	it("produces AuthenticationError when installation listing returns non-ok response", async () => {
		const mockAuth = vi.fn().mockResolvedValue({ token: "fake-jwt" });
		mockedCreateAppAuth.mockReturnValue(mockAuth as unknown as ReturnType<typeof createAppAuth>);

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status: 403, statusText: "Forbidden" }));

		const layer = GitHubAppAuth({
			appId: "123",
			privateKey: "valid-key",
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Failure");

		if (exit._tag === "Failure") {
			const failure = exit.cause as { _tag: string; error: { _tag: string; method: string; message: string } };
			expect(failure._tag).toBe("Fail");
			expect(failure.error._tag).toBe("AuthenticationError");
			expect(failure.error.method).toBe("app");
			expect(failure.error.message).toBe("Failed to list installations: 403");
		}

		fetchSpy.mockRestore();
	});

	it("produces AuthenticationError when no installations are found", async () => {
		const mockAuth = vi.fn().mockResolvedValue({ token: "fake-jwt" });
		mockedCreateAppAuth.mockReturnValue(mockAuth as unknown as ReturnType<typeof createAppAuth>);

		const fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } }),
			);

		const layer = GitHubAppAuth({
			appId: "123",
			privateKey: "valid-key",
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Failure");

		if (exit._tag === "Failure") {
			const failure = exit.cause as { _tag: string; error: { _tag: string; method: string; message: string } };
			expect(failure._tag).toBe("Fail");
			expect(failure.error._tag).toBe("AuthenticationError");
			expect(failure.error.method).toBe("app");
			expect(failure.error.message).toBe("No installations found for this GitHub App");
		}

		fetchSpy.mockRestore();
	});

	it("creates Octokit successfully when installationId is provided", async () => {
		const mockAuth = vi.fn().mockResolvedValue({ token: "ghs_installation-token" });
		mockedCreateAppAuth.mockReturnValue(mockAuth as unknown as ReturnType<typeof createAppAuth>);

		const layer = GitHubAppAuth({
			appId: "123",
			privateKey: "valid-key",
			installationId: 456,
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Success");

		expect(mockAuth).toHaveBeenCalledWith({
			type: "installation",
			installationId: 456,
		});
	});

	it("creates Octokit successfully via auto-discovered installationId", async () => {
		const mockAuth = vi
			.fn()
			.mockResolvedValueOnce({ token: "fake-jwt" })
			.mockResolvedValueOnce({ token: "ghs_installation-token" });
		mockedCreateAppAuth.mockReturnValue(mockAuth as unknown as ReturnType<typeof createAppAuth>);

		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify([{ id: 789 }]), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		);

		const layer = GitHubAppAuth({
			appId: "123",
			privateKey: "valid-key",
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Success");

		expect(mockAuth).toHaveBeenCalledWith({ type: "app" });
		expect(mockAuth).toHaveBeenCalledWith({
			type: "installation",
			installationId: 789,
		});

		fetchSpy.mockRestore();
	});
});
