import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const RateLimitErrorBase = Data.TaggedError("RateLimitError");

export class RateLimitError extends RateLimitErrorBase<{
	readonly retryAfter?: number;
	readonly limit: number;
	readonly remaining: number;
	readonly message: string;
}> {}
