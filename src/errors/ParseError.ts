import { Data } from "effect";

export class ParseError extends Data.TaggedError("ParseError")<{
	readonly source: string;
	readonly message: string;
}> {}
