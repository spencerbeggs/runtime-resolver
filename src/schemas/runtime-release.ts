import type { DateTime } from "effect";
import { Schema } from "effect";
import type { SemVer } from "semver-effect";

/**
 * Base constraint for all runtime release classes.
 * Enables generic RuntimeCache<R extends RuntimeRelease>.
 */
export interface RuntimeRelease {
	readonly _tag: string;
	readonly version: SemVer.SemVer;
	readonly date: DateTime.DateTime;
}

/**
 * Lean input schema for Bun/Deno release construction.
 * This is the shape generated defaults files export.
 */
export const RuntimeReleaseInput = Schema.Struct({
	version: Schema.String,
	date: Schema.String,
});
export type RuntimeReleaseInput = typeof RuntimeReleaseInput.Type;
