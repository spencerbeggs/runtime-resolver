import type { Effect } from "effect";
import { Context } from "effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";

export interface NodeScheduleFetcher {
	readonly fetch: () => Effect.Effect<NodeScheduleData, NetworkError | ParseError>;
}

export const NodeScheduleFetcher = Context.GenericTag<NodeScheduleFetcher>("NodeScheduleFetcher");
