import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const ParseErrorBase = Data.TaggedError("ParseError");

export class ParseError extends ParseErrorBase<{
	readonly source: string;
	readonly message: string;
}> {}
