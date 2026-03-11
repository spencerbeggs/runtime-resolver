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

export const NodeScheduleFetcherLive: Layer.Layer<NodeScheduleFetcher, never, GitHubClient> = Layer.effect(
	NodeScheduleFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		return {
			fetch: () => client.getJson(NODE_SCHEDULE_URL, { decode: decodeSchedule }),
		};
	}),
);
