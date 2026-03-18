/**
 * runtime-resolver
 *
 * Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes.
 * Promise-based API with offline fallback via build-time cache.
 * Also exports Effect services, layers, and errors for advanced composition.
 *
 * @packageDocumentation
 */
import { Effect, Layer } from "effect";
import { AutoBunCacheLive } from "./layers/AutoBunCacheLive.js";
import { AutoDenoCacheLive } from "./layers/AutoDenoCacheLive.js";
import { AutoNodeCacheLive } from "./layers/AutoNodeCacheLive.js";
import { BunResolverLive } from "./layers/BunResolverLive.js";
import { BunVersionFetcherLive } from "./layers/BunVersionFetcherLive.js";
import { DenoResolverLive } from "./layers/DenoResolverLive.js";
import { DenoVersionFetcherLive } from "./layers/DenoVersionFetcherLive.js";
import { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
import { GitHubClientLive } from "./layers/GitHubClientLive.js";
import { NodeResolverLive } from "./layers/NodeResolverLive.js";
import { NodeScheduleFetcherLive } from "./layers/NodeScheduleFetcherLive.js";
import { NodeVersionFetcherLive } from "./layers/NodeVersionFetcherLive.js";
import type { ResolvedVersions } from "./schemas/common.js";
import type { BunResolverOptions } from "./services/BunResolver.js";
import { BunResolver } from "./services/BunResolver.js";
import type { DenoResolverOptions } from "./services/DenoResolver.js";
import { DenoResolver } from "./services/DenoResolver.js";
import type { NodeResolverOptions } from "./services/NodeResolver.js";
import { NodeResolver } from "./services/NodeResolver.js";

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
const NodeFetchersLayer = Layer.merge(
	NodeVersionFetcherLive.pipe(Layer.provide(GitHubLayer)),
	NodeScheduleFetcherLive.pipe(Layer.provide(GitHubLayer)),
);
const NodeCacheLayer = AutoNodeCacheLive.pipe(Layer.provide(NodeFetchersLayer));
const NodeLayer = NodeResolverLive.pipe(Layer.provide(NodeCacheLayer));

const BunCacheLayer = AutoBunCacheLive.pipe(Layer.provide(BunVersionFetcherLive.pipe(Layer.provide(GitHubLayer))));
const BunLayer = BunResolverLive.pipe(Layer.provide(BunCacheLayer));

const DenoCacheLayer = AutoDenoCacheLive.pipe(Layer.provide(DenoVersionFetcherLive.pipe(Layer.provide(GitHubLayer))));
const DenoLayer = DenoResolverLive.pipe(Layer.provide(DenoCacheLayer));

// ── Errors ──────────────────────────────────────────────────────────────────
// Tagged error classes thrown by the Promise API and surfaced through Effect
// channels.
export { AuthenticationError } from "./errors/AuthenticationError.js";
export { CacheError } from "./errors/CacheError.js";
export { FreshnessError } from "./errors/FreshnessError.js";
export { InvalidInputError } from "./errors/InvalidInputError.js";
export { NetworkError } from "./errors/NetworkError.js";
export { ParseError } from "./errors/ParseError.js";
export { RateLimitError } from "./errors/RateLimitError.js";
export { VersionNotFoundError } from "./errors/VersionNotFoundError.js";

// ── Layers ──────────────────────────────────────────────────────────────────
// Effect `Layer` implementations that wire up every runtime resolver's full
// dependency graph. Use these when composing custom Effect pipelines instead
// of relying on the Promise API.
export { AutoBunCacheLive } from "./layers/AutoBunCacheLive.js";
export { AutoDenoCacheLive } from "./layers/AutoDenoCacheLive.js";
export { AutoNodeCacheLive } from "./layers/AutoNodeCacheLive.js";
export { BunReleaseCacheLive } from "./layers/BunReleaseCacheLive.js";
export { BunResolverLive } from "./layers/BunResolverLive.js";
export { BunVersionFetcherLive } from "./layers/BunVersionFetcherLive.js";
export { DenoReleaseCacheLive } from "./layers/DenoReleaseCacheLive.js";
export { DenoResolverLive } from "./layers/DenoResolverLive.js";
export { DenoVersionFetcherLive } from "./layers/DenoVersionFetcherLive.js";
export { FreshBunCacheLive } from "./layers/FreshBunCacheLive.js";
export { FreshDenoCacheLive } from "./layers/FreshDenoCacheLive.js";
export { FreshNodeCacheLive } from "./layers/FreshNodeCacheLive.js";
export type { GitHubAppAuthConfig } from "./layers/GitHubAppAuth.js";
export { GitHubAppAuth } from "./layers/GitHubAppAuth.js";
export { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
export { GitHubClientLive } from "./layers/GitHubClientLive.js";
export { GitHubTokenAuth, GitHubTokenAuthFromToken } from "./layers/GitHubTokenAuth.js";
export { NodeReleaseCacheLive } from "./layers/NodeReleaseCacheLive.js";
export { NodeResolverLive } from "./layers/NodeResolverLive.js";
export { NodeScheduleFetcherLive } from "./layers/NodeScheduleFetcherLive.js";
export { NodeVersionFetcherLive } from "./layers/NodeVersionFetcherLive.js";
export { OfflineBunCacheLive } from "./layers/OfflineBunCacheLive.js";
export { OfflineDenoCacheLive } from "./layers/OfflineDenoCacheLive.js";
export { OfflineNodeCacheLive } from "./layers/OfflineNodeCacheLive.js";
export { createRuntimeCache } from "./layers/RuntimeCacheLive.js";
// ── Schemas ──────────────────────────────────────────────────────────────────
// Effect `Schema` codecs for runtime release data.
export { BunRelease } from "./schemas/bun-release.js";
// ── Types ───────────────────────────────────────────────────────────────────
// TypeScript type aliases and branded primitives shared across all runtimes.
export type { Increments, NodePhase, ResolvedVersions, Runtime, Source } from "./schemas/common.js";
export { DenoRelease } from "./schemas/deno-release.js";
export type { GitHubRelease, GitHubTag } from "./schemas/github.js";
export type { NodeReleaseInput } from "./schemas/node-release.js";
export { NodeRelease } from "./schemas/node-release.js";
export type { NodeScheduleData, NodeScheduleEntry } from "./schemas/node-schedule.js";
export { NodeSchedule } from "./schemas/node-schedule.js";
export type { RuntimeRelease, RuntimeReleaseInput } from "./schemas/runtime-release.js";
// ── Services ────────────────────────────────────────────────────────────────
// Effect `Context.Tag` service interfaces and their option/error types.
// Inject these into your own Effect programs for fine-grained control over
// caching, fetching, and resolution behaviour.
export { BunReleaseCache } from "./services/BunReleaseCache.js";
export type { BunResolverError, BunResolverOptions } from "./services/BunResolver.js";
export { BunResolver } from "./services/BunResolver.js";
export { BunVersionFetcher } from "./services/BunVersionFetcher.js";
export { DenoReleaseCache } from "./services/DenoReleaseCache.js";
export type { DenoResolverError, DenoResolverOptions } from "./services/DenoResolver.js";
export { DenoResolver } from "./services/DenoResolver.js";
export { DenoVersionFetcher } from "./services/DenoVersionFetcher.js";
export type { ListOptions } from "./services/GitHubClient.js";
export { GitHubClient } from "./services/GitHubClient.js";
export { NodeReleaseCache } from "./services/NodeReleaseCache.js";
export type { NodeResolverError, NodeResolverOptions } from "./services/NodeResolver.js";
export { NodeResolver } from "./services/NodeResolver.js";
export { NodeScheduleFetcher } from "./services/NodeScheduleFetcher.js";
export { NodeVersionFetcher } from "./services/NodeVersionFetcher.js";
export { OctokitInstance } from "./services/OctokitInstance.js";
export type { RuntimeCache } from "./services/RuntimeCache.js";

// ── Promise API ─────────────────────────────────────────────────────────────

/**
 * Resolve Node.js versions matching the given options.
 *
 * Fetches release data from the Node.js GitHub repository and the official
 * release schedule API, then filters and ranks versions according to
 * `options`. Authentication is read from `GITHUB_PERSONAL_ACCESS_TOKEN` or
 * `GITHUB_TOKEN` environment variables. Falls back to a build-time offline
 * cache when the network is unavailable.
 *
 * @param options - Filtering and ranking options. See {@link NodeResolverOptions}.
 * @returns A promise that resolves to a {@link ResolvedVersions} object
 *   containing the matched version list, the highest matching version as
 *   `latest`, and optional `lts` / `default` strings.
 *
 * @example
 * ```ts
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { resolveNode } from "runtime-resolver";
 *
 * const result: ResolvedVersions = await resolveNode({
 * 	semverRange: ">=20.0.0",
 * 	phases: ["active-lts"],
 * });
 * console.log(result.latest); // e.g. "22.11.0"
 * console.log(result.versions); // all matching versions
 * ```
 *
 * @see {@link NodeResolver} for the Effect-based API
 * @see {@link NodeResolverOptions} for available options
 *
 * @public
 */
export const resolveNode = (options?: NodeResolverOptions): Promise<ResolvedVersions> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve(options);
		}).pipe(Effect.provide(NodeLayer)),
	);

/**
 * Resolve Bun versions matching the given options.
 *
 * Fetches release data from the Bun GitHub repository, then filters and ranks
 * versions according to `options`. Authentication is read from
 * `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` environment variables.
 * Falls back to a build-time offline cache when the network is unavailable.
 *
 * @param options - Filtering and ranking options. See {@link BunResolverOptions}.
 * @returns A promise that resolves to a {@link ResolvedVersions} object
 *   containing the matched version list and the highest matching version as
 *   `latest`.
 *
 * @example
 * ```ts
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { resolveBun } from "runtime-resolver";
 *
 * const result: ResolvedVersions = await resolveBun({ semverRange: "^1.0.0" });
 * console.log(result.latest);
 * ```
 *
 * @see {@link BunResolver} for the Effect-based API
 * @see {@link BunResolverOptions} for available options
 *
 * @public
 */
export const resolveBun = (options?: BunResolverOptions): Promise<ResolvedVersions> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const resolver = yield* BunResolver;
			return yield* resolver.resolve(options);
		}).pipe(Effect.provide(BunLayer)),
	);

/**
 * Resolve Deno versions matching the given options.
 *
 * Fetches release data from the Deno GitHub repository, then filters and ranks
 * versions according to `options`. Authentication is read from
 * `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` environment variables.
 * Falls back to a build-time offline cache when the network is unavailable.
 *
 * @param options - Filtering and ranking options. See {@link DenoResolverOptions}.
 * @returns A promise that resolves to a {@link ResolvedVersions} object
 *   containing the matched version list and the highest matching version as
 *   `latest`.
 *
 * @example
 * ```ts
 * import type { ResolvedVersions } from "runtime-resolver";
 * import { resolveDeno } from "runtime-resolver";
 *
 * const result: ResolvedVersions = await resolveDeno({ semverRange: "^2.0.0" });
 * console.log(result.latest);
 * ```
 *
 * @see {@link DenoResolver} for the Effect-based API
 * @see {@link DenoResolverOptions} for available options
 *
 * @public
 */
export const resolveDeno = (options?: DenoResolverOptions): Promise<ResolvedVersions> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve(options);
		}).pipe(Effect.provide(DenoLayer)),
	);
