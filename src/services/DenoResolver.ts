import type { Effect } from "effect";
import { Context } from "effect";
import type { CacheError } from "../errors/CacheError.js";
import type { FreshnessError } from "../errors/FreshnessError.js";
import type { InvalidInputError } from "../errors/InvalidInputError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Freshness, Increments, ResolvedVersions } from "../schemas/common.js";

export interface DenoResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
	readonly freshness?: Freshness;
}

type DenoResolverError =
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

export interface DenoResolverShape {
	readonly resolve: (options?: DenoResolverOptions) => Effect.Effect<ResolvedVersions, DenoResolverError>;
	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, DenoResolverError>;
}

export class DenoResolver extends Context.Tag("DenoResolver")<DenoResolver, DenoResolverShape>() {}
