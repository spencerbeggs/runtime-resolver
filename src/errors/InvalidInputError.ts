import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const InvalidInputErrorBase = Data.TaggedError("InvalidInputError");

export class InvalidInputError extends InvalidInputErrorBase<{
	readonly field: string;
	readonly value: string;
	readonly message: string;
}> {}
