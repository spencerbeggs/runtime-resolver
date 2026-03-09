import { Schema } from "effect";

/**
 * Structured error in CLI output. Uses _tag to identify the error type.
 * Additional fields vary by error type and are passed through as-is.
 */
export const CliErrorDetail = Schema.Struct({
	_tag: Schema.String.annotations({ description: "Error type identifier (e.g. RateLimitError, SemverError)" }),
	message: Schema.String.annotations({ description: "Human-readable error message" }),
}).pipe(
	Schema.extend(
		Schema.Record({
			key: Schema.String,
			value: Schema.Unknown.annotations({
				description: "Additional error-specific metadata",
				title: "ErrorMetadata",
			}),
		}),
	),
	Schema.annotations({
		identifier: "CliErrorDetail",
		description: "Structured error with type tag, message, and optional metadata",
	}),
);
export type CliErrorDetail = typeof CliErrorDetail.Type;

/**
 * Successful resolution for a single runtime.
 */
export const CliRuntimeSuccess = Schema.Struct({
	ok: Schema.Literal(true).annotations({ description: "Indicates successful resolution" }),
	versions: Schema.Array(Schema.String.annotations({ description: "Semver version string" })).annotations({
		description: "All resolved versions matching the semver range",
	}),
	latest: Schema.String.annotations({ description: "Most recent version matching the range" }),
	lts: Schema.optional(Schema.String.annotations({ description: "Current LTS version (Node.js only)" })),
	default: Schema.optional(Schema.String.annotations({ description: "Default recommended version (Deno only)" })),
}).annotations({
	identifier: "CliRuntimeSuccess",
	description: "Successful version resolution for a single runtime",
});
export type CliRuntimeSuccess = typeof CliRuntimeSuccess.Type;

/**
 * Failed resolution for a single runtime.
 */
export const CliRuntimeError = Schema.Struct({
	ok: Schema.Literal(false).annotations({ description: "Indicates failed resolution" }),
	error: CliErrorDetail,
}).annotations({
	identifier: "CliRuntimeError",
	description: "Failed version resolution for a single runtime",
});
export type CliRuntimeError = typeof CliRuntimeError.Type;

/**
 * Per-runtime result: success or error.
 */
export const CliRuntimeResult = Schema.Union(CliRuntimeSuccess, CliRuntimeError).annotations({
	identifier: "CliRuntimeResult",
	description: "Per-runtime resolution result: either success with versions or error with details",
});
export type CliRuntimeResult = typeof CliRuntimeResult.Type;

/**
 * Full CLI success response — all runtimes resolved.
 */
export const CliSuccessResponse = Schema.Struct({
	ok: Schema.Literal(true).annotations({ description: "True when all requested runtimes resolved successfully" }),
	results: Schema.Record({
		key: Schema.String.annotations({ description: "Runtime name (node, bun, or deno)" }),
		value: CliRuntimeResult,
	}).annotations({ description: "Map of runtime name to resolution result" }),
}).annotations({
	identifier: "CliSuccessResponse",
	description: "All requested runtimes resolved successfully",
});
export type CliSuccessResponse = typeof CliSuccessResponse.Type;

/**
 * Full CLI error response — at least one runtime failed.
 */
export const CliErrorResponse = Schema.Struct({
	ok: Schema.Literal(false).annotations({
		description: "False when one or more requested runtimes failed to resolve",
	}),
	results: Schema.Record({
		key: Schema.String.annotations({ description: "Runtime name (node, bun, or deno)" }),
		value: CliRuntimeResult,
	}).annotations({ description: "Map of runtime name to resolution result" }),
}).annotations({
	identifier: "CliErrorResponse",
	description: "One or more requested runtimes failed to resolve",
});
export type CliErrorResponse = typeof CliErrorResponse.Type;

/**
 * Top-level CLI response envelope.
 */
export const CliResponse = Schema.Union(CliSuccessResponse, CliErrorResponse).annotations({
	identifier: "CliResponse",
	title: "RuntimeResolverResponse",
	description:
		"CLI response envelope. Contains an ok discriminator and a results map with per-runtime resolution outcomes.",
});
export type CliResponse = typeof CliResponse.Type;
