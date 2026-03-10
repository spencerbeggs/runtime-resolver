import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const CacheErrorBase = Data.TaggedError("CacheError");

export class CacheError extends CacheErrorBase<{
	readonly operation: "read" | "write";
	readonly message: string;
}> {}
