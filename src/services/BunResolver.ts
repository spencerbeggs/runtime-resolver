import type { Effect } from "effect";
import { Context } from "effect";
import type { CacheError } from "../errors/CacheError.js";
import type { InvalidInputError } from "../errors/InvalidInputError.js";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RateLimitError } from "../errors/RateLimitError.js";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";

export interface BunResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
}

type BunResolverError =
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| CacheError;

export interface BunResolverShape {
	readonly resolve: (options?: BunResolverOptions) => Effect.Effect<ResolvedVersions, BunResolverError>;
}

export class BunResolver extends Context.Tag("BunResolver")<BunResolver, BunResolverShape>() {}
