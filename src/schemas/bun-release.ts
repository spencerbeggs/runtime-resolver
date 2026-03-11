import { Data, DateTime, Effect } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "./runtime-release.js";

/**
 * @internal
 * Exported for declaration bundling — see AuthenticationError.ts for details.
 */
export const BunReleaseBase = Data.TaggedClass("BunRelease");

/**
 * A Bun release with parsed SemVer version and DateTime date.
 */
export class BunRelease extends BunReleaseBase<{
	readonly version: SemVer.SemVer;
	readonly date: DateTime.DateTime;
}> {
	/**
	 * Create a BunRelease from lean input strings.
	 */
	static fromInput(input: RuntimeReleaseInput): Effect.Effect<BunRelease, InvalidVersionError> {
		return Effect.gen(function* () {
			const version = yield* SemVer.fromString(input.version);
			// Fall back to current time if published_at is null (rare).
			const date = input.date ? DateTime.unsafeMake(input.date) : DateTime.unsafeMake(new Date());
			return new BunRelease({ version, date });
		});
	}
}
