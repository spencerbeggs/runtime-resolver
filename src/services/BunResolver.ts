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

export type BunResolverError =
	| AuthenticationError
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

/**
 * Service interface for resolving Bun runtime versions.
 */
export interface BunResolver {
	readonly resolve: (options?: BunResolverOptions) => Effect.Effect<ResolvedVersions, BunResolverError>;
	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, BunResolverError>;
}

/** @deprecated Use {@link BunResolver} instead. */
export type BunResolverShape = BunResolver;

/**
 * BunResolver tag for dependency injection.
 *
 * @internal Uses GenericTag to avoid generating un-nameable `_base` types
 * that break the declaration bundler (api-extractor) when re-exported via
 * `export *`.
 */
export const BunResolver = Context.GenericTag<BunResolver>("BunResolver");
