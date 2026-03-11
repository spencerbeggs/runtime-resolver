import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { RuntimeReleaseInput } from "./runtime-release.js";

describe("RuntimeReleaseInput", () => {
	it("decodes a valid input", () => {
		const result = Schema.decodeUnknownSync(RuntimeReleaseInput)({
			version: "1.2.3",
			date: "2025-01-15",
		});
		expect(result.version).toBe("1.2.3");
		expect(result.date).toBe("2025-01-15");
	});

	it("rejects missing version", () => {
		expect(() => Schema.decodeUnknownSync(RuntimeReleaseInput)({ date: "2025-01-15" })).toThrow();
	});

	it("rejects missing date", () => {
		expect(() => Schema.decodeUnknownSync(RuntimeReleaseInput)({ version: "1.2.3" })).toThrow();
	});
});
