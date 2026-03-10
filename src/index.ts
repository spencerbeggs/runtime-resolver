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
import { BunResolverLive } from "./layers/BunResolverLive.js";
import { DenoResolverLive } from "./layers/DenoResolverLive.js";
import { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
import { GitHubClientLive } from "./layers/GitHubClientLive.js";
import { NodeResolverLive } from "./layers/NodeResolverLive.js";
import { VersionCacheLive } from "./layers/VersionCacheLive.js";
import type { ResolvedVersions } from "./schemas/common.js";
import type { BunResolverOptions } from "./services/BunResolver.js";
import { BunResolver } from "./services/BunResolver.js";
import type { DenoResolverOptions } from "./services/DenoResolver.js";
import { DenoResolver } from "./services/DenoResolver.js";
import type { NodeResolverOptions } from "./services/NodeResolver.js";
import { NodeResolver } from "./services/NodeResolver.js";

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
const SharedLayer = Layer.merge(GitHubLayer, VersionCacheLive);
const NodeLayer = NodeResolverLive.pipe(Layer.provide(SharedLayer));
const BunLayer = BunResolverLive.pipe(Layer.provide(SharedLayer));
const DenoLayer = DenoResolverLive.pipe(Layer.provide(SharedLayer));

// ── Errors ──────────────────────────────────────────────────────────────────
// Bases are @internal — exported only for declaration bundling (api-extractor).
export { AuthenticationError, AuthenticationErrorBase } from "./errors/AuthenticationError.js";
export { CacheError, CacheErrorBase } from "./errors/CacheError.js";
export { FreshnessError, FreshnessErrorBase } from "./errors/FreshnessError.js";
export { InvalidInputError, InvalidInputErrorBase } from "./errors/InvalidInputError.js";
export { NetworkError, NetworkErrorBase } from "./errors/NetworkError.js";
export { ParseError, ParseErrorBase } from "./errors/ParseError.js";
export { RateLimitError, RateLimitErrorBase } from "./errors/RateLimitError.js";
export { VersionNotFoundError, VersionNotFoundErrorBase } from "./errors/VersionNotFoundError.js";

// ── Layers ──────────────────────────────────────────────────────────────────
export { BunResolverLive } from "./layers/BunResolverLive.js";
export { DenoResolverLive } from "./layers/DenoResolverLive.js";
export type { GitHubAppAuthConfig } from "./layers/GitHubAppAuth.js";
export { GitHubAppAuth } from "./layers/GitHubAppAuth.js";
export { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
export { GitHubClientLive } from "./layers/GitHubClientLive.js";
export { GitHubTokenAuth, GitHubTokenAuthFromToken } from "./layers/GitHubTokenAuth.js";
export { NodeResolverLive } from "./layers/NodeResolverLive.js";
export { VersionCacheLive } from "./layers/VersionCacheLive.js";
export type { CachedNodeData, CachedTagData } from "./schemas/cache.js";
// ── Types ───────────────────────────────────────────────────────────────────
export type { Freshness, Increments, NodePhase, ResolvedVersions, Runtime, Source } from "./schemas/common.js";
export type { GitHubRelease, GitHubTag } from "./schemas/github.js";
// ── Services ────────────────────────────────────────────────────────────────
export type { BunResolverError, BunResolverOptions } from "./services/BunResolver.js";
export { BunResolver } from "./services/BunResolver.js";
export type { DenoResolverError, DenoResolverOptions } from "./services/DenoResolver.js";
export { DenoResolver } from "./services/DenoResolver.js";
export type { ListOptions } from "./services/GitHubClient.js";
export { GitHubClient } from "./services/GitHubClient.js";
export type { NodeResolverError, NodeResolverOptions } from "./services/NodeResolver.js";
export { NodeResolver } from "./services/NodeResolver.js";
export { OctokitInstance } from "./services/OctokitInstance.js";
export type { CachedData } from "./services/VersionCache.js";
export { VersionCache } from "./services/VersionCache.js";

// ── Promise API ─────────────────────────────────────────────────────────────

/**
 * Resolve Node.js versions matching the given options.
 *
 * Uses GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN for authentication.
 * Falls back to build-time cache when the network is unavailable.
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
 * Uses GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN for authentication.
 * Falls back to build-time cache when the network is unavailable.
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
 * Uses GITHUB_PERSONAL_ACCESS_TOKEN or GITHUB_TOKEN for authentication.
 * Falls back to build-time cache when the network is unavailable.
 */
export const resolveDeno = (options?: DenoResolverOptions): Promise<ResolvedVersions> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const resolver = yield* DenoResolver;
			return yield* resolver.resolve(options);
		}).pipe(Effect.provide(DenoLayer)),
	);
