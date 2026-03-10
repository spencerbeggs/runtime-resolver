import { describe, expect, it } from "vitest";
import { cliJsonSchema } from "./json-schema.js";

describe("cliJsonSchema", () => {
	it("produces a valid JSON Schema object", () => {
		expect(cliJsonSchema).toBeDefined();
		expect(typeof cliJsonSchema).toBe("object");
		// Effect's JSONSchema.make produces a $defs-based schema
		expect(cliJsonSchema).toHaveProperty("$schema");
	});

	it("uses $defs with $ref for named schema definitions", () => {
		const schema = cliJsonSchema as unknown as Record<string, unknown>;
		expect(schema).toHaveProperty("$ref", "#/$defs/CliResponse");
		expect(schema).toHaveProperty("$defs");
		const defs = schema.$defs as Record<string, unknown>;
		expect(defs).toHaveProperty("CliResponse");
		expect(defs).toHaveProperty("CliRuntimeSuccess");
		expect(defs).toHaveProperty("CliRuntimeError");
		expect(defs).toHaveProperty("CliErrorDetail");
	});

	it("is JSON-serializable", () => {
		const json = JSON.stringify(cliJsonSchema);
		const parsed = JSON.parse(json);
		expect(parsed).toEqual(cliJsonSchema);
	});
});
