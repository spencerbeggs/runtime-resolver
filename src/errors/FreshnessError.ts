import { Data } from "effect";
import type { Freshness } from "../schemas/common.js";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const FreshnessErrorBase = Data.TaggedError("FreshnessError");

export class FreshnessError extends FreshnessErrorBase<{
	readonly strategy: Freshness;
	readonly message: string;
}> {}
