import type { Effect } from "effect";
import { Context } from "effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";

/**
 * Service for fetching the official Node.js release schedule.
 *
 * The schedule maps each major release line to its LTS start date and
 * end-of-life date, and is used by {@link NodeReleaseCache} to assign
 * lifecycle phases to individual releases. The live implementation fetches
 * from the `nodejs/Release` GitHub repository via a plain HTTP request.
 *
 * @example
 * ```typescript
 * import type { NodeScheduleData } from "runtime-resolver";
 * import { NodeScheduleFetcher, NodeScheduleFetcherLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const fetcher = yield* NodeScheduleFetcher;
 * 	const schedule = yield* fetcher.fetch();
 * 	console.log(Object.keys(schedule).length, "major release lines");
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeScheduleFetcherLive)));
 * ```
 *
 * @see {@link NodeScheduleFetcherLive}
 * @see {@link NodeReleaseCache}
 * @see {@link NodeScheduleData}
 * @see {@link NetworkError}
 * @see {@link ParseError}
 *
 * @public
 */
export class NodeScheduleFetcher extends Context.Tag("runtime-resolver/NodeScheduleFetcher")<
	NodeScheduleFetcher,
	{
		/**
		 * Fetches and decodes the Node.js release schedule JSON, returning a
		 * typed {@link NodeScheduleData} map keyed by major release line.
		 *
		 * Fails with:
		 * - {@link NetworkError} — the upstream request could not be completed.
		 * - {@link ParseError} — the response payload could not be decoded.
		 */
		readonly fetch: () => Effect.Effect<NodeScheduleData, NetworkError | ParseError>;
	}
>() {}
