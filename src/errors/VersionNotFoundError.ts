import { Data } from "effect";

export class VersionNotFoundError extends Data.TaggedError("VersionNotFoundError")<{
	readonly runtime: string;
	readonly constraint: string;
	readonly message: string;
}> {}
