import { Data } from "effect";

export class RateLimitError extends Data.TaggedError("RateLimitError")<{
	readonly retryAfter?: number;
	readonly limit: number;
	readonly remaining: number;
	readonly message: string;
}> {}
