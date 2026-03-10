import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { cliJsonSchema } from "./schemas/json-schema.js";
import { CliResponse } from "./schemas/response.js";

describe("CLI schemas integration", () => {
	it("JSON Schema is valid and serializable", () => {
		expect(cliJsonSchema).toBeDefined();
		expect(typeof cliJsonSchema).toBe("object");
		const serialized = JSON.stringify(cliJsonSchema);
		expect(() => JSON.parse(serialized)).not.toThrow();
	});

	it("can encode a success response", () => {
		const response = {
			ok: true as const,
			results: {
				node: {
					ok: true as const,
					source: "api",
					versions: ["22.15.0", "20.19.0"],
					latest: "22.15.0",
					lts: "20.19.0",
				},
			},
		};
		const encoded = Schema.encodeSync(CliResponse)(response);
		expect(JSON.parse(JSON.stringify(encoded))).toEqual(response);
	});

	it("can encode a partial failure response", () => {
		const response = {
			ok: false as const,
			results: {
				node: {
					ok: true as const,
					source: "api",
					versions: ["22.15.0"],
					latest: "22.15.0",
				},
				bun: {
					ok: false as const,
					error: {
						_tag: "RateLimitError",
						message: "Rate limited",
						limit: 60,
						remaining: 0,
					},
				},
			},
		};
		const encoded = Schema.encodeSync(CliResponse)(response);
		expect(encoded.ok).toBe(false);
	});

	it("round-trips through encode/decode", () => {
		const original = {
			ok: true as const,
			results: {
				deno: {
					ok: true as const,
					source: "cache",
					versions: ["2.0.0", "1.45.0"],
					latest: "2.0.0",
				},
			},
		};
		const encoded = Schema.encodeSync(CliResponse)(original);
		const decoded = Schema.decodeUnknownSync(CliResponse)(encoded);
		expect(decoded).toEqual(original);
	});
});
