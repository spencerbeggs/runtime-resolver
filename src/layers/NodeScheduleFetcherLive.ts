import { Effect, Layer, Schema } from "effect";
import { ParseError } from "../errors/ParseError.js";
import { NodeReleaseSchedule } from "../schemas/node.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";

const NODE_SCHEDULE_URL = "https://raw.githubusercontent.com/nodejs/Release/refs/heads/main/schedule.json";

const decodeSchedule = (input: unknown): Effect.Effect<NodeScheduleData, ParseError> =>
	Schema.decodeUnknown(NodeReleaseSchedule)(input).pipe(
		Effect.mapError(
			(e) =>
				new ParseError({
					source: NODE_SCHEDULE_URL,
					message: `Schema validation failed: ${e.message}`,
				}),
		),
		Effect.map((data) => data as NodeScheduleData),
	);

/**
 * Provides the {@link NodeScheduleFetcher} service using the live Node.js release schedule.
 *
 * Fetches the Node.js release schedule from the raw GitHub content URL for
 * `nodejs/Release` (`schedule.json` on the `main` branch) using the HTTP client
 * on the provided {@link GitHubClient} service. The schedule data maps major
 * version codenames to their start, LTS, and end-of-life dates and is used by
 * {@link NodeReleaseCache} to compute per-release lifecycle phases.
 *
 * This layer is a required dependency of {@link AutoNodeCacheLive} and
 * {@link FreshNodeCacheLive}. It is not needed by {@link OfflineNodeCacheLive}.
 *
 * @see {@link NodeScheduleFetcher}
 * @see {@link GitHubClient}
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @public
 */
export const NodeScheduleFetcherLive: Layer.Layer<NodeScheduleFetcher, never, GitHubClient> = Layer.effect(
	NodeScheduleFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		return {
			fetch: () => client.getJson(NODE_SCHEDULE_URL, { decode: decodeSchedule }),
		};
	}),
);
