import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";

export interface DenoVersionFetcher {
	readonly fetch: () => Effect.Effect<
		{
			readonly versions: ReadonlyArray<SemVer.SemVer>;
			readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
		},
		AuthenticationError | NetworkError | ParseError | RateLimitError
	>;
}

export const DenoVersionFetcher = Context.GenericTag<DenoVersionFetcher>("DenoVersionFetcher");
