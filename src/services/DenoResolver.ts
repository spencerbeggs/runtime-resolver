import type { Effect } from "effect";
import { Context } from "effect";
import type { CacheError } from "../errors/CacheError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { ResolvedVersions } from "../schemas/common.js";

export interface DenoResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
}

type DenoResolverError = NetworkError | ParseError | RateLimitError | VersionNotFoundError | CacheError;

export interface DenoResolverShape {
	readonly resolve: (options?: DenoResolverOptions) => Effect.Effect<ResolvedVersions, DenoResolverError>;
}

export class DenoResolver extends Context.Tag("DenoResolver")<DenoResolver, DenoResolverShape>() {}
