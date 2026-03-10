import { Data } from "effect";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const NetworkErrorBase = Data.TaggedError("NetworkError");

export class NetworkError extends NetworkErrorBase<{
	readonly url: string;
	readonly status?: number;
	readonly message: string;
}> {}
