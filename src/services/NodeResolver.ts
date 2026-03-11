import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, NodePhase, ResolvedVersions } from "../schemas/common.js";

export interface NodeResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly phases?: ReadonlyArray<NodePhase>;
	readonly increments?: Increments;
	readonly date?: Date;
}

export type NodeResolverError = VersionNotFoundError;

/**
 * Service interface for resolving Node.js runtime versions.
 */
export interface NodeResolver {
	readonly resolve: (options?: NodeResolverOptions) => Effect.Effect<ResolvedVersions, NodeResolverError>;
}

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const NodeResolver = Context.GenericTag<NodeResolver>("NodeResolver");
