import { Data } from "effect";

export class InvalidInputError extends Data.TaggedError("InvalidInputError")<{
	readonly field: string;
	readonly value: string;
	readonly message: string;
}> {}
