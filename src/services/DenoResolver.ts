import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";

export interface DenoResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
}

export type DenoResolverError = VersionNotFoundError;

/**
 * Service interface for resolving Deno runtime versions.
 */
export interface DenoResolver {
	readonly resolve: (options?: DenoResolverOptions) => Effect.Effect<ResolvedVersions, DenoResolverError>;
}

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const DenoResolver = Context.GenericTag<DenoResolver>("DenoResolver");
