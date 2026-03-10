import type { Effect } from "effect";
import { Context } from "effect";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import type { CacheError } from "../errors/CacheError.js";
import type { FreshnessError } from "../errors/FreshnessError.js";
import type { InvalidInputError } from "../errors/InvalidInputError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Freshness, Increments, ResolvedVersions } from "../schemas/common.js";

export interface BunResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
	readonly freshness?: Freshness;
}

type BunResolverError =
	| AuthenticationError
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

export interface BunResolverShape {
	readonly resolve: (options?: BunResolverOptions) => Effect.Effect<ResolvedVersions, BunResolverError>;
	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, BunResolverError>;
}

export class BunResolver extends Context.Tag("BunResolver")<BunResolver, BunResolverShape>() {}
