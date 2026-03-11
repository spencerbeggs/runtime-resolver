import type { DateTime } from "effect";
import { Schema } from "effect";
import type { SemVer } from "semver-effect";

/**
 * Structural base constraint shared by {@link BunRelease}, {@link DenoRelease},
 * and {@link NodeRelease}.
 *
 * Enables the generic `RuntimeCache<R extends RuntimeRelease>` service to
 * operate over any runtime release type without coupling to a concrete class.
 *
 * @see {@link RuntimeCache}
 * @see {@link BunRelease}
 * @see {@link DenoRelease}
 * @see {@link NodeRelease}
 *
 * @public
 */
export interface RuntimeRelease {
	readonly _tag: string;
	readonly version: SemVer.SemVer;
	readonly date: DateTime.DateTime;
}

/**
 * Lean input schema used to construct {@link BunRelease} and
 * {@link DenoRelease} instances from bundled default data files.
 *
 * Both Bun and Deno source their offline snapshots from JSON/TS data files
 * whose entries conform to this shape. The `version` and `date` fields are
 * plain strings that are subsequently parsed by `SemVer.fromString` and
 * `DateTime.unsafeMake` respectively.
 *
 * @see {@link BunRelease.fromInput}
 * @see {@link DenoRelease.fromInput}
 *
 * @public
 */
export const RuntimeReleaseInput = Schema.Struct({
	version: Schema.String,
	date: Schema.String,
});

/**
 * Lean input type used to construct {@link BunRelease} and {@link DenoRelease}
 * instances from bundled default data files.
 *
 * @see {@link BunRelease.fromInput}
 * @see {@link DenoRelease.fromInput}
 *
 * @public
 */
export type RuntimeReleaseInput = typeof RuntimeReleaseInput.Type;
