import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";

/**
 * Options accepted by {@link BunResolver.resolve}.
 *
 * All fields are optional; omitting them causes the resolver to fall back to
 * its built-in defaults (latest stable release, `"latest"` increment
 * granularity).
 *
 * @see {@link BunResolver}
 * @see {@link Increments}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export interface BunResolverOptions {
	/**
	 * A semver range string used to constrain which Bun releases are
	 * considered (e.g. `"^1.0.0"` or `">=1.1.0 <2.0.0"`).
	 *
	 * When omitted all cached releases are eligible.
	 */
	readonly semverRange?: string;

	/**
	 * A fallback version string returned when no release satisfies
	 * `semverRange`. Must be a valid semver version (e.g. `"1.0.0"`).
	 *
	 * When omitted and no match is found the effect fails with
	 * {@link VersionNotFoundError}.
	 */
	readonly defaultVersion?: string;

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
}

/**
 * Union of all typed errors that {@link BunResolver.resolve} can fail with.
 *
 * @see {@link VersionNotFoundError}
 *
 * @public
 */
export type BunResolverError = VersionNotFoundError;

/**
 * Service interface for resolving Bun runtime versions against the cached
 * release index.
 *
 * @see {@link BunResolverLive}
 * @see {@link resolveBun}
 * @see {@link BunResolverOptions}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export interface BunResolver {
	/**
	 * Resolves Bun versions according to `options` and returns a
	 * {@link ResolvedVersions} object containing the matching version list,
	 * the latest version string, and the data source indicator.
	 *
	 * Fails with {@link BunResolverError} when no version can be resolved and
	 * no `defaultVersion` was provided.
	 *
	 * @param options - Optional resolution constraints.
	 *
	 * @see {@link BunResolverOptions}
	 */
	readonly resolve: (options?: BunResolverOptions) => Effect.Effect<ResolvedVersions, BunResolverError>;
}

/**
 * Service tag and companion object for {@link BunResolver}.
 *
 * Acts as both the TypeScript service interface and the Effect dependency tag
 * used for dependency injection (companion object pattern). Yield this tag
 * inside `Effect.gen` to obtain the resolver implementation provided by
 * {@link BunResolverLive}.
 *
 * For a one-shot Promise-based API see {@link resolveBun}.
 *
 * @example
 * ```typescript
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { BunResolver, BunResolverLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const resolver = yield* BunResolver;
 * 	const result = yield* resolver.resolve({ semverRange: "^1.0.0", increments: "minor" });
 * 	console.log(result.latest);
 * 	console.log(result.versions);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(BunResolverLive)));
 * ```
 *
 * @see {@link BunResolverLive}
 * @see {@link resolveBun}
 *
 * @public
 */
export const BunResolver = Context.GenericTag<BunResolver>("BunResolver");
