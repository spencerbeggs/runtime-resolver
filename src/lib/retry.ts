import { Effect, Predicate, Schedule } from "effect";

/**
 * Wraps an effect with automatic retry logic for {@link RateLimitError}.
 *
 * When the wrapped effect fails with a `RateLimitError` the retry schedule
 * applies exponential backoff starting at a 1-second base delay, doubling on
 * each attempt, for a maximum of 3 retries. Errors with any other tag are
 * re-raised immediately without retrying.
 *
 * The predicate used for the `while` condition is
 * `Predicate.isTagged("RateLimitError")`, so only errors whose `_tag` field
 * equals `"RateLimitError"` trigger a retry; all other error types propagate
 * unchanged.
 *
 * @see {@link RateLimitError}
 *
 * @internal
 */
export const retryOnRateLimit = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	effect.pipe(
		Effect.retry({
			schedule: Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))),
			while: Predicate.isTagged("RateLimitError"),
		}),
	);
