import type { Effect } from "effect";
import { Context } from "effect";
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

type NodeResolverError =
	| NetworkError
	| ParseError
	| RateLimitError
	| VersionNotFoundError
	| InvalidInputError
	| FreshnessError
	| CacheError;

export interface NodeResolverShape {
	readonly resolve: (options?: NodeResolverOptions) => Effect.Effect<ResolvedVersions, NodeResolverError>;

	readonly resolveVersion: (versionOrRange: string) => Effect.Effect<string, NodeResolverError>;
}

export class NodeResolver extends Context.Tag("NodeResolver")<NodeResolver, NodeResolverShape>() {}
