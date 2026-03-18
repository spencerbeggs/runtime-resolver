import { Effect, Option } from "effect";
import { SemVer } from "semver-effect";

/**
 * Attempts to parse a raw version string into a {@link SemVer}, returning
 * `Option.none()` when the string is not a valid semver value.
 *
 * Unlike `SemVer.parse` — which fails the effect on an unparseable input —
 * this helper absorbs parse failures and promotes them into the `Option` channel
 * so that callers can handle invalid versions without short-circuiting the
 * surrounding effect pipeline.
 *
 * @see {@link SemVer.parse}
 *
 * @internal
 */
export const tryParseSemVer = (raw: string): Effect.Effect<Option.Option<SemVer>> =>
	SemVer.parse(raw).pipe(
		Effect.map(Option.some),
		Effect.catchAll(() => Effect.succeed(Option.none())),
	);
