import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const FreshnessErrorBase = Data.TaggedError("FreshnessError");

export class FreshnessError extends FreshnessErrorBase<{
	readonly strategy: "auto" | "api" | "cache";
	readonly message: string;
}> {}
