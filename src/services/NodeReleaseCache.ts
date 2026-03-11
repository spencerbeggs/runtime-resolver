import type { DateTime, Effect } from "effect";
import { Context } from "effect";
import type { NodeRelease, NodeReleaseInput } from "../schemas/node-release.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Node-specific cache extending RuntimeCache with schedule operations.
 */
export interface NodeReleaseCache extends RuntimeCache<NodeRelease> {
	readonly updateSchedule: (data: NodeScheduleData) => Effect.Effect<void>;
	readonly loadFromInputs: (inputs: ReadonlyArray<NodeReleaseInput>) => Effect.Effect<void>;
	readonly ltsReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;
	readonly currentReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;
}

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const NodeReleaseCache = Context.GenericTag<NodeReleaseCache>("NodeReleaseCache");
