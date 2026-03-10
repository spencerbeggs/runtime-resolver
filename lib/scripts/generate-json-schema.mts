#!/usr/bin/env npx tsx
/**
 * Generates the CLI response JSON Schema file at the repo root.
 * Only writes when content has actually changed.
 *
 * Usage: tsx lib/scripts/generate-json-schema.mts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { JSONSchema } from "effect";
import { CliResponse } from "../../src/cli/schemas/response.js";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUTPUT = path.join(ROOT, "runtime-resolver.schema.json");

const schema = JSONSchema.make(CliResponse);
const content = JSON.stringify(schema, null, "\t");

const existing = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf-8") : "";

if (content !== existing) {
	fs.writeFileSync(OUTPUT, `${content}\n`, "utf-8");
	console.log(`Generated ${path.basename(OUTPUT)}`);
} else {
	console.log(`${path.basename(OUTPUT)}: unchanged`);
}
