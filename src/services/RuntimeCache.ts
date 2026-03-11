import type { Effect } from "effect";
import type { EmptyCacheError, UnsatisfiedRangeError } from "semver-effect";
import type { RuntimeRelease } from "../schemas/runtime-release.js";

/**
 * Generic cache service wrapping semver-effect's VersionCache
 * with typed release lookup.
 */
export interface RuntimeCache<R extends RuntimeRelease> {
	readonly load: (releases: ReadonlyArray<R>) => Effect.Effect<void>;
	readonly resolve: (range: string) => Effect.Effect<R, UnsatisfiedRangeError>;
	readonly releases: () => Effect.Effect<ReadonlyArray<R>>;
	readonly filter: (range: string) => Effect.Effect<ReadonlyArray<R>>;
	readonly latest: () => Effect.Effect<R, EmptyCacheError>;
	readonly latestByMajor: () => Effect.Effect<ReadonlyArray<R>>;
	readonly latestByMinor: () => Effect.Effect<ReadonlyArray<R>>;
}
