import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import {
	CliErrorDetail,
	CliErrorResponse,
	CliResponse,
	CliRuntimeError,
	CliRuntimeResult,
	CliRuntimeSuccess,
	CliSuccessResponse,
} from "./response.js";

const decode = <A, I>(schema: Schema.Schema<A, I>) => Schema.decodeUnknownSync(schema);

describe("CliErrorDetail", () => {
	it("decodes with only _tag and message", () => {
		const input = { _tag: "NetworkError", message: "Connection refused" };
		const result = decode(CliErrorDetail)(input);
		expect(result._tag).toBe("NetworkError");
		expect(result.message).toBe("Connection refused");
	});

	it("decodes with additional fields", () => {
		const input = {
			_tag: "RateLimitError",
			message: "Rate limited",
			limit: 60,
			remaining: 0,
			retryAfter: 42,
		};
		const result = decode(CliErrorDetail)(input);
		expect(result._tag).toBe("RateLimitError");
		expect(result.limit).toBe(60);
		expect(result.retryAfter).toBe(42);
	});

	it("rejects missing _tag", () => {
		expect(() => decode(CliErrorDetail)({ message: "no tag" })).toThrow();
	});

	it("rejects missing message", () => {
		expect(() => decode(CliErrorDetail)({ _tag: "Foo" })).toThrow();
	});
});

describe("CliRuntimeSuccess", () => {
	it("decodes a valid success with all fields", () => {
		const input = {
			ok: true,
			source: "api",
			versions: ["22.0.0", "20.0.0"],
			latest: "22.0.0",
			lts: "20.0.0",
			default: "20.0.0",
		};
		const result = decode(CliRuntimeSuccess)(input);
		expect(result.ok).toBe(true);
		expect(result.source).toBe("api");
		expect(result.versions).toEqual(["22.0.0", "20.0.0"]);
		expect(result.latest).toBe("22.0.0");
		expect(result.lts).toBe("20.0.0");
		expect(result.default).toBe("20.0.0");
	});

	it("decodes a valid success without optional fields", () => {
		const input = {
			ok: true,
			source: "cache",
			versions: ["1.0.0"],
			latest: "1.0.0",
		};
		const result = decode(CliRuntimeSuccess)(input);
		expect(result.ok).toBe(true);
		expect(result.source).toBe("cache");
		expect(result.versions).toEqual(["1.0.0"]);
		expect(result.latest).toBe("1.0.0");
		expect(result.lts).toBeUndefined();
		expect(result.default).toBeUndefined();
	});

	it("rejects invalid ok value", () => {
		const input = {
			ok: false,
			source: "api",
			versions: ["1.0.0"],
			latest: "1.0.0",
		};
		expect(() => decode(CliRuntimeSuccess)(input)).toThrow();
	});
});

describe("CliRuntimeError", () => {
	it("decodes a valid error", () => {
		const input = {
			ok: false,
			error: {
				_tag: "VersionNotFoundError",
				message: "No versions found",
				runtime: "node",
				constraint: ">=99.0.0",
			},
		};
		const result = decode(CliRuntimeError)(input);
		expect(result.ok).toBe(false);
		expect(result.error._tag).toBe("VersionNotFoundError");
		expect(result.error.message).toBe("No versions found");
		expect(result.error.runtime).toBe("node");
	});

	it("decodes an error with only _tag and message", () => {
		const input = {
			ok: false,
			error: {
				_tag: "NetworkError",
				message: "Connection refused",
			},
		};
		const result = decode(CliRuntimeError)(input);
		expect(result.ok).toBe(false);
		expect(result.error._tag).toBe("NetworkError");
		expect(result.error.message).toBe("Connection refused");
	});
});

describe("CliRuntimeResult", () => {
	it("decodes a success variant", () => {
		const input = {
			ok: true,
			source: "api",
			versions: ["1.0.0"],
			latest: "1.0.0",
		};
		const result = decode(CliRuntimeResult)(input);
		expect(result.ok).toBe(true);
	});

	it("decodes an error variant", () => {
		const input = {
			ok: false,
			error: {
				_tag: "ParseError",
				message: "Invalid data",
			},
		};
		const result = decode(CliRuntimeResult)(input);
		expect(result.ok).toBe(false);
	});
});

describe("CliResponse", () => {
	it("decodes a full success response", () => {
		const input = {
			ok: true,
			results: {
				node: {
					ok: true,
					source: "api",
					versions: ["22.0.0", "20.0.0"],
					latest: "22.0.0",
					lts: "20.0.0",
				},
				bun: {
					ok: true,
					source: "cache",
					versions: ["1.1.0"],
					latest: "1.1.0",
				},
			},
		};
		const result = decode(CliSuccessResponse)(input);
		expect(result.ok).toBe(true);
		expect(Object.keys(result.results)).toEqual(["node", "bun"]);
	});

	it("decodes a partial failure response", () => {
		const input = {
			ok: false,
			results: {
				node: {
					ok: true,
					source: "api",
					versions: ["22.0.0"],
					latest: "22.0.0",
				},
				deno: {
					ok: false,
					error: {
						_tag: "NetworkError",
						message: "Timeout",
						url: "https://api.github.com",
					},
				},
			},
		};
		const result = decode(CliErrorResponse)(input);
		expect(result.ok).toBe(false);
	});

	it("decodes either variant via CliResponse union", () => {
		const successInput = {
			ok: true,
			results: {
				bun: {
					ok: true,
					source: "api",
					versions: ["1.0.0"],
					latest: "1.0.0",
				},
			},
		};
		const errorInput = {
			ok: false,
			results: {
				node: {
					ok: false,
					error: {
						_tag: "CacheError",
						message: "Cache miss",
					},
				},
			},
		};
		expect(decode(CliResponse)(successInput).ok).toBe(true);
		expect(decode(CliResponse)(errorInput).ok).toBe(false);
	});
});
