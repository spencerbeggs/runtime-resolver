import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, NodePhase, ResolvedVersions } from "../schemas/common.js";

/**
 * Options accepted by {@link NodeResolver.resolve}.
 *
 * All fields are optional; omitting them causes the resolver to fall back to
 * its built-in defaults (all lifecycle phases, latest stable release,
 * `"latest"` increment granularity, current wall-clock date).
 *
 * @see {@link NodeResolver}
 * @see {@link NodePhase}
 * @see {@link Increments}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export interface NodeResolverOptions {
	/**
	 * A semver range string used to constrain which Node.js releases are
	 * considered (e.g. `"^20.0.0"` or `">=18.0.0 <22.0.0"`).
	 *
	 * When omitted all cached releases are eligible.
	 */
	readonly semverRange?: string;

	/**
	 * A fallback version string returned when no release satisfies
	 * `semverRange`. Must be a valid semver version (e.g. `"20.0.0"`).
	 *
	 * When omitted and no match is found the effect fails with
	 * {@link VersionNotFoundError}.
	 */
	readonly defaultVersion?: string;

	/**
	 * Restricts resolution to releases whose lifecycle phase is included in
	 * this list. For example, passing `["active-lts"]` excludes `"current"`
	 * and `"maintenance-lts"` releases from consideration.
	 *
	 * When omitted all phases are eligible.
	 *
	 * @see {@link NodePhase}
	 */
	readonly phases?: ReadonlyArray<NodePhase>;

	/**
	 * Controls the granularity of the version list included in
	 * {@link ResolvedVersions.versions}.
	 *
	 * - `"latest"` — only the single highest matching version.
	 * - `"minor"` — the latest patch for every minor line.
	 * - `"patch"` — every individual patch release.
	 *
	 * Defaults to `"latest"` when omitted.
	 *
	 * @see {@link Increments}
	 */
	readonly increments?: Increments;

	/**
	 * Reference date used when evaluating Node.js lifecycle phases. Releases
	 * whose LTS or end-of-life boundaries fall relative to this date are
	 * classified accordingly.
	 *
	 * When omitted the current wall-clock date is used.
	 */
	readonly date?: Date;
}

/**
 * Union of all typed errors that {@link NodeResolver.resolve} can fail with.
 *
 * @see {@link VersionNotFoundError}
 *
 * @public
 */
export type NodeResolverError = VersionNotFoundError;

/**
 * Service interface for resolving Node.js runtime versions against the cached
 * release index.
 *
 * Unlike {@link BunResolver} and {@link DenoResolver}, this service is
 * lifecycle-aware: results can be filtered by {@link NodePhase} and evaluated
 * against a specific reference date.
 *
 * @see {@link NodeResolverLive}
 * @see {@link resolveNode}
 * @see {@link NodeResolverOptions}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export interface NodeResolver {
	/**
	 * Resolves Node.js versions according to `options` and returns a
	 * {@link ResolvedVersions} object containing the matching version list,
	 * the latest version string, optional LTS version string, and the data
	 * source indicator.
	 *
	 * Fails with {@link NodeResolverError} when no version can be resolved and
	 * no `defaultVersion` was provided.
	 *
	 * @param options - Optional resolution constraints.
	 *
	 * @see {@link NodeResolverOptions}
	 */
	readonly resolve: (options?: NodeResolverOptions) => Effect.Effect<ResolvedVersions, NodeResolverError>;
}

/**
 * Service tag and companion object for {@link NodeResolver}.
 *
 * Acts as both the TypeScript service interface and the Effect dependency tag
 * used for dependency injection (companion object pattern). Yield this tag
 * inside `Effect.gen` to obtain the resolver implementation provided by
 * {@link NodeResolverLive}.
 *
 * For a one-shot Promise-based API see {@link resolveNode}.
 *
 * @example
 * ```typescript
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { NodeResolver, NodeResolverLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const resolver = yield* NodeResolver;
 * 	const result = yield* resolver.resolve({
 * 		semverRange: "^20.0.0",
 * 		phases: ["active-lts"],
 * 		increments: "minor",
 * 	});
 * 	console.log(result.latest);
 * 	console.log(result.lts);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeResolverLive)));
 * ```
 *
 * @see {@link NodeResolverLive}
 * @see {@link resolveNode}
 *
 * @public
 */
export const NodeResolver = Context.GenericTag<NodeResolver>("NodeResolver");
