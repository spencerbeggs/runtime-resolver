import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";

export interface BunResolverOptions {
	readonly semverRange?: string;
	readonly defaultVersion?: string;
	readonly increments?: Increments;
}

export type BunResolverError = VersionNotFoundError;

/**
 * Service interface for resolving Bun runtime versions.
 */
export interface BunResolver {
	readonly resolve: (options?: BunResolverOptions) => Effect.Effect<ResolvedVersions, BunResolverError>;
}

/**
 * BunResolver tag for dependency injection.
 *
 * @internal Uses GenericTag to avoid generating un-nameable `_base` types
 * that break the declaration bundler (api-extractor) when re-exported via
 * `export *`.
 */
export const BunResolver = Context.GenericTag<BunResolver>("BunResolver");
