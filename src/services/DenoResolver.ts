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

export interface DenoResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
	readonly freshness?: Freshness;
}

export type DenoResolverError =
	| AuthenticationError
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

/**
 * Service interface for resolving Deno runtime versions.
 */
export interface DenoResolver {
	readonly resolve: (options?: DenoResolverOptions) => Effect.Effect<ResolvedVersions, DenoResolverError>;
	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, DenoResolverError>;
}

/** @deprecated Use {@link DenoResolver} instead. */
export type DenoResolverShape = DenoResolver;

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const DenoResolver = Context.GenericTag<DenoResolver>("DenoResolver");
