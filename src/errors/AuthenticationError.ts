import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling (api-extractor). When `export *` re-exports
 * a class whose `extends` expression is an inline call like
 * `Data.TaggedError(...)`, TypeScript emits an un-nameable `_base` symbol in
 * the declaration file. Splitting the base into a named export gives the
 * bundler a stable reference.
 */
export const AuthenticationErrorBase = Data.TaggedError("AuthenticationError");

export class AuthenticationError extends AuthenticationErrorBase<{
	readonly method: "token" | "app";
	readonly message: string;
}> {}
