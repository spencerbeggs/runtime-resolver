import { Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import type { Increments } from "../schemas/common.js";
import type { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import type { DenoResolverOptions } from "../services/DenoResolver.js";
import { DenoResolver } from "../services/DenoResolver.js";

export const DenoResolverLive: Layer.Layer<DenoResolver, never, DenoReleaseCache> = Layer.effect(
	DenoResolver,
	Effect.gen(function* () {
		const cache = yield* DenoReleaseCache;

		return {
			resolve: (options?: DenoResolverOptions) =>
				Effect.gen(function* () {
					const semverRange = options?.semverRange ?? "*";
					const increments: Increments = options?.increments ?? "latest";

					const matching = yield* cache
						.filter(semverRange)
						.pipe(Effect.catchAll(() => Effect.succeed([] as ReadonlyArray<DenoRelease>)));

					let resultReleases: DenoRelease[];
					if (increments === "latest") {
						const groups = new Map<number, DenoRelease>();
						for (const r of matching) {
							const existing = groups.get(r.version.major);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(r.version.major, r);
							}
						}
						resultReleases = [...groups.values()];
					} else if (increments === "minor") {
						const groups = new Map<string, DenoRelease>();
						for (const r of matching) {
							const key = `${r.version.major}.${r.version.minor}`;
							const existing = groups.get(key);
							if (!existing || SemVer.gt(r.version, existing.version)) {
								groups.set(key, r);
							}
						}
						resultReleases = [...groups.values()];
					} else {
						resultReleases = [...matching];
					}

					if (resultReleases.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "deno",
								constraint: semverRange,
								message: `No Deno versions found matching "${semverRange}"`,
							}),
						);
					}

					const sorted = SemVer.rsort(resultReleases.map((r) => r.version));
					const versions = sorted.map((v) => v.toString());
					const latest = versions[0];

					let resolvedDefault: string | undefined;
					if (options?.defaultVersion) {
						resolvedDefault = yield* cache.resolve(options.defaultVersion).pipe(
							Effect.map((r) => r.version.toString()),
							Effect.catchAll(() => Effect.succeed(undefined)),
						);
					}

					return {
						source: "api" as const,
						versions,
						latest,
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					};
				}),
		};
	}),
);
