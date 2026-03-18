import { Data, DateTime, Effect } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "./runtime-release.js";

/**
 * A Bun release entry with a parsed {@link SemVer} version and an
 * Effect {@link DateTime.DateTime} publication date.
 *
 * `BunRelease` extends `Data.TaggedClass` so instances support structural
 * equality comparison and can be used safely inside Effect data structures.
 * Construct instances via the {@link BunRelease.fromInput} factory rather than
 * calling `new BunRelease(...)` directly, as the factory validates the version
 * string through `SemVer.parse`.
 *
 * @see {@link BunReleaseCache}
 * @see {@link BunResolver}
 * @see {@link RuntimeReleaseInput}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { BunRelease } from "./bun-release.js";
 * import { BunRelease as BunReleaseClass } from "./bun-release.js";
 *
 * const program = BunReleaseClass.fromInput({ version: "1.1.0", date: "2024-03-01" }).pipe(
 *   Effect.map((release: BunRelease) => {
 *     console.log(release.version.major); // 1
 *     console.log(release.version.minor); // 1
 *     console.log(release._tag);          // "BunRelease"
 *   }),
 * );
 *
 * Effect.runPromise(program);
 * ```
 *
 * @public
 */
export class BunRelease extends Data.TaggedClass("BunRelease")<{
	readonly version: SemVer;
	readonly date: DateTime.DateTime;
}> {
	/**
	 * Create a {@link BunRelease} from lean string inputs.
	 *
	 * Parses `input.version` via `SemVer.parse` and constructs the
	 * publication date with `DateTime.unsafeMake`. Falls back to the current
	 * timestamp when `input.date` is an empty string (rare in production data).
	 *
	 * @param input - A {@link RuntimeReleaseInput} object with raw string fields.
	 * @returns An `Effect` that succeeds with a `BunRelease` or fails with an
	 *   `InvalidVersionError` when the version string cannot be parsed.
	 */
	static fromInput(input: RuntimeReleaseInput): Effect.Effect<BunRelease, InvalidVersionError> {
		return Effect.gen(function* () {
			const version = yield* SemVer.parse(input.version);
			// Fall back to current time if published_at is null (rare).
			const date = input.date ? DateTime.unsafeMake(input.date) : DateTime.unsafeMake(new Date());
			return new BunRelease({ version, date });
		});
	}
}
