import { Schema } from "effect";

/**
 * Discriminates which JavaScript runtime a resolver targets.
 *
 * @see {@link resolveNode}
 * @see {@link resolveBun}
 * @see {@link resolveDeno}
 *
 * @public
 */
export const Runtime = Schema.Literal("node", "bun", "deno");

/**
 * Discriminates which JavaScript runtime a resolver targets.
 *
 * @see {@link resolveNode}
 * @see {@link resolveBun}
 * @see {@link resolveDeno}
 *
 * @public
 */
export type Runtime = typeof Runtime.Type;

/**
 * Indicates whether a {@link ResolvedVersions} result was served from
 * a live API call or a local cache.
 *
 * @public
 */
export const Source = Schema.Literal("api", "cache");

/**
 * Indicates whether a {@link ResolvedVersions} result was served from
 * a live API call or a local cache.
 *
 * @public
 */
export type Source = typeof Source.Type;

/**
 * The primary return type produced by every runtime resolver.
 *
 * Contains the full list of matching versions, the latest version string, and
 * optional `lts` / `default` version strings depending on the runtime.
 * The `source` field indicates whether the data came from a live API call or
 * a cached snapshot.
 *
 * @see {@link resolveNode}
 * @see {@link resolveBun}
 * @see {@link resolveDeno}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { ResolvedVersions } from "./common.js";
 * import { resolveNode } from "../resolvers/node.js";
 *
 * const program: Effect.Effect<ResolvedVersions> = resolveNode(">=20");
 *
 * Effect.runPromise(program).then((result: ResolvedVersions) => {
 *   console.log(result.latest);   // e.g. "22.3.0"
 *   console.log(result.source);   // "api" | "cache"
 *   console.log(result.versions); // ["22.3.0", "22.2.0", ...]
 * });
 * ```
 *
 * @public
 */
export const ResolvedVersions = Schema.Struct({
	source: Source,
	versions: Schema.Array(Schema.String),
	latest: Schema.String,
	lts: Schema.optional(Schema.String),
	default: Schema.optional(Schema.String),
});

/**
 * The primary return type produced by every runtime resolver.
 *
 * @see {@link resolveNode}
 * @see {@link resolveBun}
 * @see {@link resolveDeno}
 *
 * @public
 */
export type ResolvedVersions = typeof ResolvedVersions.Type;

/**
 * Lifecycle phase of a Node.js major release line, derived from the official
 * Node.js release schedule.
 *
 * - `"current"` — actively receiving features and bug fixes.
 * - `"active-lts"` — Long-Term Support; stable, receiving only bug and
 *   security fixes.
 * - `"maintenance-lts"` — critical security fixes only.
 * - `"end-of-life"` — no longer maintained.
 *
 * @see {@link NodeRelease.phase}
 *
 * @public
 */
export const NodePhase = Schema.Literal("current", "active-lts", "maintenance-lts", "end-of-life");

/**
 * Lifecycle phase of a Node.js major release line.
 *
 * @see {@link NodeRelease.phase}
 *
 * @public
 */
export type NodePhase = typeof NodePhase.Type;

/**
 * Controls the granularity at which matching versions are grouped when a
 * resolver returns multiple results.
 *
 * - `"latest"` — return only the single highest matching version.
 * - `"minor"` — return the latest patch for every minor line.
 * - `"patch"` — return every individual patch release.
 *
 * @public
 */
export const Increments = Schema.Literal("latest", "minor", "patch");

/**
 * Controls the granularity at which matching versions are grouped.
 *
 * @public
 */
export type Increments = typeof Increments.Type;
