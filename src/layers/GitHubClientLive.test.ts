import { Cause, Effect, Exit, Layer, Schema } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubClientLive } from "./GitHubClientLive.js";

const makeTag = (name: string) => ({
	name,
	zipball_url: `https://example.com/${name}.zip`,
	tarball_url: `https://example.com/${name}.tar.gz`,
	commit: { sha: "abc123", url: `https://example.com/commits/abc123` },
	node_id: `node_${name}`,
});

const makeRelease = (tag_name: string) => ({
	tag_name,
	name: tag_name,
	draft: false,
	prerelease: false,
	published_at: "2025-01-01T00:00:00Z",
});

const buildLayer = (octokit: OctokitInstance) => {
	const mockLayer = Layer.succeed(OctokitInstance, octokit);
	return GitHubClientLive.pipe(Layer.provide(mockLayer));
};

const extractFailure = <E>(exit: Exit.Exit<unknown, E>): E | undefined => {
	if (Exit.isFailure(exit)) {
		const option = Cause.failureOption(exit.cause);
		if (option._tag === "Some") return option.value;
	}
	return undefined;
};

describe("GitHubClientLive", () => {
	describe("mapOctokitError", () => {
		it("maps 401 to AuthenticationError", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit);
			expect(error).toBeDefined();
			expect((error as AuthenticationError)._tag).toBe("AuthenticationError");
			expect((error as AuthenticationError).method).toBe("token");
		});

		it("maps 403 to RateLimitError with retry-after header", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () =>
							Promise.reject(
								Object.assign(new Error("Rate limited"), {
									status: 403,
									response: {
										headers: {
											"retry-after": "60",
											"x-ratelimit-limit": "5000",
											"x-ratelimit-remaining": "0",
										},
									},
								}),
							),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as RateLimitError;
			expect(error._tag).toBe("RateLimitError");
			expect(error.retryAfter).toBe(60);
			expect(error.limit).toBe(5000);
			expect(error.remaining).toBe(0);
		});

		it("maps 429 to RateLimitError without retry-after header", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () =>
							Promise.reject(
								Object.assign(new Error("Too many requests"), {
									status: 429,
								}),
							),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as RateLimitError;
			expect(error._tag).toBe("RateLimitError");
			expect(error.retryAfter).toBeUndefined();
			expect(error.limit).toBe(0);
			expect(error.remaining).toBe(0);
		});

		it("maps generic error to NetworkError", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () =>
							Promise.reject(
								Object.assign(new Error("Server error"), {
									status: 500,
								}),
							),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as NetworkError;
			expect(error._tag).toBe("NetworkError");
			expect(error.status).toBe(500);
			expect(error.message).toBe("Server error");
		});

		it("maps non-Error thrown value to NetworkError", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject("string error"),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as NetworkError;
			expect(error._tag).toBe("NetworkError");
			expect(error.message).toBe("string error");
		});
	});

	describe("listTags", () => {
		it("returns tags from a single page", async () => {
			const tags = [makeTag("v1.0.0"), makeTag("v1.1.0")];
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.resolve({ data: tags }),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("v1.0.0");
			expect(result[1].name).toBe("v1.1.0");
		});

		it("paginates across multiple pages", async () => {
			const page1 = Array.from({ length: 10 }, (_, i) => makeTag(`v1.${i}.0`));
			const page2 = [makeTag("v2.0.0")];
			let callCount = 0;

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => {
							callCount++;
							if (callCount === 1) return Promise.resolve({ data: page1 });
							return Promise.resolve({ data: page2 });
						},
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo", { perPage: 10, pages: 3 });
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(11);
			expect(callCount).toBe(2);
		});

		it("stops early when page returns fewer results than perPage", async () => {
			const page1 = Array.from({ length: 5 }, (_, i) => makeTag(`v1.${i}.0`));
			let callCount = 0;

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => {
							callCount++;
							return Promise.resolve({ data: page1 });
						},
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo", { perPage: 10, pages: 5 });
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(5);
			expect(callCount).toBe(1);
		});

		it("fails with ParseError on invalid schema data", async () => {
			const invalidTags = [{ name: "v1.0.0" }]; // missing required fields
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.resolve({ data: invalidTags }),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listTags("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as ParseError;
			expect(error._tag).toBe("ParseError");
			expect(error.source).toBe("repos/owner/repo/tags");
		});
	});

	describe("listReleases", () => {
		it("returns releases from a single page", async () => {
			const releases = [makeRelease("v1.0.0"), makeRelease("v2.0.0")];
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.resolve({ data: releases }),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listReleases("owner", "repo");
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(2);
			expect(result[0].tag_name).toBe("v1.0.0");
			expect(result[1].tag_name).toBe("v2.0.0");
		});

		it("paginates across multiple pages", async () => {
			const page1 = Array.from({ length: 10 }, (_, i) => makeRelease(`v1.${i}.0`));
			const page2 = [makeRelease("v2.0.0")];
			let callCount = 0;

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => {
							callCount++;
							if (callCount === 1) return Promise.resolve({ data: page1 });
							return Promise.resolve({ data: page2 });
						},
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listReleases("owner", "repo", { perPage: 10, pages: 3 });
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(11);
			expect(callCount).toBe(2);
		});

		it("stops early when page returns fewer results than perPage", async () => {
			const page1 = Array.from({ length: 3 }, (_, i) => makeRelease(`v1.${i}.0`));
			let callCount = 0;

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => {
							callCount++;
							return Promise.resolve({ data: page1 });
						},
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listReleases("owner", "repo", { perPage: 10, pages: 5 });
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result).toHaveLength(3);
			expect(callCount).toBe(1);
		});

		it("maps 401 error to AuthenticationError", async () => {
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(Object.assign(new Error("Bad credentials"), { status: 401 })),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listReleases("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as AuthenticationError;
			expect(error._tag).toBe("AuthenticationError");
			expect(error.method).toBe("token");
		});

		it("fails with ParseError on invalid schema data", async () => {
			const invalidReleases = [{ tag_name: "v1.0.0" }]; // missing required fields
			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.resolve({ data: invalidReleases }),
					},
				},
			});

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.listReleases("owner", "repo");
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as ParseError;
			expect(error._tag).toBe("ParseError");
			expect(error.source).toBe("repos/owner/repo/releases");
		});
	});

	describe("getJson", () => {
		it("fetches and decodes JSON successfully", async () => {
			const mockData = { value: 42 };
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve({
						ok: true,
						status: 200,
						statusText: "OK",
						json: () => Promise.resolve(mockData),
					}),
				),
			);

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const testSchema = {
				decode: (input: unknown) =>
					Schema.decodeUnknown(Schema.Struct({ value: Schema.Number }))(input).pipe(
						Effect.mapError(
							(e) =>
								new ParseError({
									source: "test",
									message: `Schema validation failed: ${e.message}`,
								}),
						),
					),
			};

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.getJson("https://example.com/data.json", testSchema);
			});

			const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
			expect(result.value).toBe(42);

			vi.unstubAllGlobals();
		});

		it("fails with NetworkError on HTTP error response", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve({
						ok: false,
						status: 404,
						statusText: "Not Found",
						json: () => Promise.resolve({}),
					}),
				),
			);

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const testSchema = {
				decode: (input: unknown) => Effect.succeed(input),
			};

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.getJson("https://example.com/missing.json", testSchema);
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as NetworkError;
			expect(error._tag).toBe("NetworkError");
			expect(error.url).toBe("https://example.com/missing.json");
			expect(error.status).toBe(404);
			expect(error.message).toBe("HTTP 404: Not Found");

			vi.unstubAllGlobals();
		});

		it("fails with NetworkError on fetch rejection", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(() => Promise.reject(new Error("DNS resolution failed"))),
			);

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const testSchema = {
				decode: (input: unknown) => Effect.succeed(input),
			};

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.getJson("https://example.com/data.json", testSchema);
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as NetworkError;
			expect(error._tag).toBe("NetworkError");
			expect(error.url).toBe("https://example.com/data.json");
			expect(error.message).toBe("DNS resolution failed");

			vi.unstubAllGlobals();
		});

		it("fails with ParseError on JSON parse failure", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve({
						ok: true,
						status: 200,
						statusText: "OK",
						json: () => Promise.reject(new SyntaxError("Unexpected token")),
					}),
				),
			);

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const testSchema = {
				decode: (input: unknown) => Effect.succeed(input),
			};

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.getJson("https://example.com/bad.json", testSchema);
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as ParseError;
			expect(error._tag).toBe("ParseError");
			expect(error.source).toBe("https://example.com/bad.json");
			expect(error.message).toBe("Failed to parse JSON response");

			vi.unstubAllGlobals();
		});

		it("fails with ParseError on schema decode failure", async () => {
			vi.stubGlobal(
				"fetch",
				vi.fn(() =>
					Promise.resolve({
						ok: true,
						status: 200,
						statusText: "OK",
						json: () => Promise.resolve({ wrong: "shape" }),
					}),
				),
			);

			const testLayer = buildLayer({
				rest: {
					repos: {
						listTags: () => Promise.reject(new Error("unused")),
						listReleases: () => Promise.reject(new Error("unused")),
					},
				},
			});

			const testSchema = {
				decode: (_input: unknown) =>
					Effect.fail(
						new ParseError({
							source: "https://example.com/data.json",
							message: "Schema validation failed",
						}),
					),
			};

			const program = Effect.gen(function* () {
				const client = yield* GitHubClient;
				return yield* client.getJson("https://example.com/data.json", testSchema);
			});

			const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(testLayer)));
			const error = extractFailure(exit) as ParseError;
			expect(error._tag).toBe("ParseError");
			expect(error.message).toBe("Schema validation failed");

			vi.unstubAllGlobals();
		});
	});
});
