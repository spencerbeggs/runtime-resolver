import { Effect, Predicate, Schedule } from "effect";

export const retryOnRateLimit = <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
	effect.pipe(
		Effect.retry({
			schedule: Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))),
			while: Predicate.isTagged("RateLimitError"),
		}),
	);
