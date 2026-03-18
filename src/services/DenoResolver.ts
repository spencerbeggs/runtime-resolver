import type { Effect } from "effect";
import { Context } from "effect";
import type { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";

/**
 * Options accepted by {@link DenoResolver.resolve}.
 *
 * All fields are optional; omitting them causes the resolver to fall back to
 * its built-in defaults (latest stable release, `"latest"` increment
 * granularity).
 *
 * @see {@link DenoResolver}
 * @see {@link Increments}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export interface DenoResolverOptions {
	/**
	 * A semver range string used to constrain which Deno releases are
	 * considered (e.g. `"^2.0.0"` or `">=1.40.0 <2.0.0"`).
	 *
	 * When omitted all cached releases are eligible.
	 */
	readonly semverRange?: string;

	/**
	 * A fallback version string returned when no release satisfies
	 * `semverRange`. Must be a valid semver version (e.g. `"2.0.0"`).
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
 * Union of all typed errors that {@link DenoResolver.resolve} can fail with.
 *
 * @see {@link VersionNotFoundError}
 *
 * @public
 */
export type DenoResolverError = VersionNotFoundError;

/**
 * Service for resolving Deno runtime versions against the cached
 * release index.
 *
 * For a one-shot Promise-based API see {@link resolveDeno}.
 *
 * @example
 * ```typescript
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { DenoResolver, DenoResolverLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const resolver = yield* DenoResolver;
 * 	const result = yield* resolver.resolve({ semverRange: "^2.0.0", increments: "minor" });
 * 	console.log(result.latest);
 * 	console.log(result.versions);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(DenoResolverLive)));
 * ```
 *
 * @see {@link DenoResolverLive}
 * @see {@link resolveDeno}
 * @see {@link DenoResolverOptions}
 * @see {@link ResolvedVersions}
 *
 * @public
 */
export class DenoResolver extends Context.Tag("runtime-resolver/DenoResolver")<
	DenoResolver,
	{
		/**
		 * Resolves Deno versions according to `options` and returns a
		 * {@link ResolvedVersions} object containing the matching version list,
		 * the latest version string, and the data source indicator.
		 *
		 * Fails with {@link DenoResolverError} when no version can be resolved and
		 * no `defaultVersion` was provided.
		 *
		 * @param options - Optional resolution constraints.
		 *
		 * @see {@link DenoResolverOptions}
		 */
		readonly resolve: (options?: DenoResolverOptions) => Effect.Effect<ResolvedVersions, DenoResolverError>;
	}
>() {}
