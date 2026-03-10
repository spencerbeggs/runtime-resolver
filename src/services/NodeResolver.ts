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
import type { Freshness, Increments, NodePhase, ResolvedVersions } from "../schemas/common.js";

export interface NodeResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly phases?: ReadonlyArray<NodePhase>;
	readonly increments?: Increments;
	readonly date?: Date;
	readonly freshness?: Freshness;
}

export type NodeResolverError =
	| AuthenticationError
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

/**
 * Service interface for resolving Node.js runtime versions.
 */
export interface NodeResolver {
	readonly resolve: (options?: NodeResolverOptions) => Effect.Effect<ResolvedVersions, NodeResolverError>;
	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, NodeResolverError>;
}

/** @deprecated Use {@link NodeResolver} instead. */
export type NodeResolverShape = NodeResolver;

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const NodeResolver = Context.GenericTag<NodeResolver>("NodeResolver");
