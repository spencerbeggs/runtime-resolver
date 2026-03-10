import { Data } from "effect";
import type { Freshness } from "../schemas/common.js";

export class FreshnessError extends Data.TaggedError("FreshnessError")<{
	readonly strategy: Freshness;
	readonly message: string;
}> {}
