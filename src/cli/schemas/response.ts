import { Schema } from "effect";

/**
 * Structured error in CLI output. Uses _tag to identify the error type.
 * Additional fields vary by error type and are passed through as-is.
 */
export const CliErrorDetail = Schema.Struct({
	_tag: Schema.String,
	message: Schema.String,
}).pipe(Schema.extend(Schema.Record({ key: Schema.String, value: Schema.Unknown })));

/**
 * Successful resolution for a single runtime.
 */
export const CliRuntimeSuccess = Schema.Struct({
	ok: Schema.Literal(true),
	versions: Schema.Array(Schema.String),
	latest: Schema.String,
	lts: Schema.optional(Schema.String),
	default: Schema.optional(Schema.String),
});
export type CliRuntimeSuccess = typeof CliRuntimeSuccess.Type;

/**
 * Failed resolution for a single runtime.
 */
export const CliRuntimeError = Schema.Struct({
	ok: Schema.Literal(false),
	error: CliErrorDetail,
});
export type CliRuntimeError = typeof CliRuntimeError.Type;

/**
 * Per-runtime result: success or error.
 */
export const CliRuntimeResult = Schema.Union(CliRuntimeSuccess, CliRuntimeError);
export type CliRuntimeResult = typeof CliRuntimeResult.Type;

/**
 * Full CLI success response — all runtimes resolved.
 */
export const CliSuccessResponse = Schema.Struct({
	ok: Schema.Literal(true),
	results: Schema.Record({ key: Schema.String, value: CliRuntimeResult }),
});
export type CliSuccessResponse = typeof CliSuccessResponse.Type;

/**
 * Full CLI error response — at least one runtime failed.
 */
export const CliErrorResponse = Schema.Struct({
	ok: Schema.Literal(false),
	results: Schema.Record({ key: Schema.String, value: CliRuntimeResult }),
});
export type CliErrorResponse = typeof CliErrorResponse.Type;

/**
 * Top-level CLI response envelope.
 */
export const CliResponse = Schema.Union(CliSuccessResponse, CliErrorResponse);
export type CliResponse = typeof CliResponse.Type;
