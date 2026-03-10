import { Data } from "effect";
import type { Runtime } from "../schemas/common.js";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const VersionNotFoundErrorBase = Data.TaggedError("VersionNotFoundError");

export class VersionNotFoundError extends VersionNotFoundErrorBase<{
	readonly runtime: Runtime;
	readonly constraint: string;
	readonly message: string;
}> {}
