import { Data } from "effect";

export class NetworkError extends Data.TaggedError("NetworkError")<{
	readonly url: string;
	readonly status?: number;
	readonly message: string;
}> {}
