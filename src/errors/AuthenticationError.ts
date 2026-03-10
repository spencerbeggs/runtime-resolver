import { Data } from "effect";

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<{
	readonly method: "token" | "app";
	readonly message: string;
}> {}
