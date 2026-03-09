import { describe, expect, it } from "vitest";
import { cliJsonSchema } from "./json-schema.js";

describe("cliJsonSchema", () => {
	it("produces a valid JSON Schema object", () => {
		expect(cliJsonSchema).toBeDefined();
		expect(typeof cliJsonSchema).toBe("object");
		// Effect's JSONSchema.make produces a $defs-based schema
		expect(cliJsonSchema).toHaveProperty("$schema");
	});

	it("describes the response structure with union variants", () => {
		const schema = cliJsonSchema as unknown as Record<string, unknown>;
		// The top-level schema should use oneOf or anyOf for the Union type
		const hasUnionCombinator = "oneOf" in schema || "anyOf" in schema;
		expect(hasUnionCombinator).toBe(true);
	});

	it("is JSON-serializable", () => {
		const json = JSON.stringify(cliJsonSchema);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(cliJsonSchema);
	});
});
