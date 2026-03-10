/**
 * runtime-resolver
 *
 * Resolve semver-compatible versions of Node.js, Bun, and Deno runtimes.
 * Promise-based API with offline fallback via build-time cache.
 * Re-exports all Effect services, layers, errors, and schemas.
 *
 * @packageDocumentation
 */
import { Effect } from "effect";
import { BunLayer, DenoLayer, NodeLayer } from "./layers/index.js";
import type { ResolvedVersions } from "./schemas/common.js";
import type { BunResolverOptions } from "./services/BunResolver.js";
import { BunResolver } from "./services/BunResolver.js";
import type { DenoResolverOptions } from "./services/DenoResolver.js";
import { DenoResolver } from "./services/DenoResolver.js";
import type { NodeResolverOptions } from "./services/NodeResolver.js";
import { NodeResolver } from "./services/NodeResolver.js";

// Re-export all Effect API plumbing (services, layers, errors, schemas)
export * from "./effect.js";

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
