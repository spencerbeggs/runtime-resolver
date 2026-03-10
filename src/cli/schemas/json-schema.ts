import { JSONSchema } from "effect";
import { CliResponse } from "./response.js";

/**
 * JSON Schema for the CLI response envelope.
 * Used by --schema flag and can be published alongside the package.
 */
export const cliJsonSchema = JSONSchema.make(CliResponse);
