import { Effect, Option } from "effect";
import { SemVer } from "semver-effect";

/**
 * Try to parse a raw version string into a SemVer, returning Option.none on failure.
 */
export const tryParseSemVer = (raw: string): Effect.Effect<Option.Option<SemVer.SemVer>> =>
	SemVer.fromString(raw).pipe(
		Effect.map(Option.some),
		Effect.catchAll(() => Effect.succeed(Option.none())),
	);
