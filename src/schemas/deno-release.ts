import { Data, DateTime, Effect } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "./runtime-release.js";

/**
 * @internal
 *
 * Exported for declaration bundling (api-extractor). When `export *`
 * re-exports a class whose `extends` expression is an inline call like
 * `Data.TaggedClass(...)`, TypeScript emits an un-nameable `_base` symbol in
 * the declaration file. Splitting the base into a named export gives the
 * bundler a stable reference.
 *
 * @privateRemarks
 * This base constant must remain a named export so that api-extractor can
 * resolve the extends clause of {@link DenoRelease} to a stable declaration.
 * Without it the bundled `.d.ts` would contain an anonymous `_base` symbol
 * that cannot be referenced by downstream consumers.
 */
export const DenoReleaseBase = Data.TaggedClass("DenoRelease");

/**
 * A Deno release entry with a parsed {@link SemVer.SemVer} version and an
 * Effect {@link DateTime.DateTime} publication date.
 *
 * `DenoRelease` extends `Data.TaggedClass` so instances support structural
 * equality comparison and can be used safely inside Effect data structures.
 * Construct instances via the {@link DenoRelease.fromInput} factory rather than
 * calling `new DenoRelease(...)` directly, as the factory validates the version
 * string through `SemVer.fromString`.
 *
 * @see {@link DenoReleaseCache}
 * @see {@link DenoResolver}
 * @see {@link RuntimeReleaseInput}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { DenoRelease } from "./deno-release.js";
 * import { DenoRelease as DenoReleaseClass } from "./deno-release.js";
 *
 * const program = DenoReleaseClass.fromInput({ version: "1.44.0", date: "2024-05-23" }).pipe(
 *   Effect.map((release: DenoRelease) => {
 *     console.log(release.version.major); // 1
 *     console.log(release.version.minor); // 44
 *     console.log(release._tag);          // "DenoRelease"
 *   }),
 * );
 *
 * Effect.runPromise(program);
 * ```
 *
 * @public
 */
export class DenoRelease extends DenoReleaseBase<{
	readonly version: SemVer.SemVer;
	readonly date: DateTime.DateTime;
}> {
	/**
	 * Create a {@link DenoRelease} from lean string inputs.
	 *
	 * Parses `input.version` via `SemVer.fromString` and constructs the
	 * publication date with `DateTime.unsafeMake`. Falls back to the current
	 * timestamp when `input.date` is an empty string (rare in production data).
	 *
	 * @param input - A {@link RuntimeReleaseInput} object with raw string fields.
	 * @returns An `Effect` that succeeds with a `DenoRelease` or fails with an
	 *   `InvalidVersionError` when the version string cannot be parsed.
	 */
	static fromInput(input: RuntimeReleaseInput): Effect.Effect<DenoRelease, InvalidVersionError> {
		return Effect.gen(function* () {
			const version = yield* SemVer.fromString(input.version);
			// Fall back to current time if published_at is null (rare).
			const date = input.date ? DateTime.unsafeMake(input.date) : DateTime.unsafeMake(new Date());
			return new DenoRelease({ version, date });
		});
	}
}
