import { Data } from "effect";
import type { Runtime } from "../schemas/common.js";

export class VersionNotFoundError extends Data.TaggedError("VersionNotFoundError")<{
	readonly runtime: Runtime;
	readonly constraint: string;
	readonly message: string;
}> {}
