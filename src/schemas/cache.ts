import { Schema } from "effect";
import { GitHubTag } from "./github.js";
import { NodeDistVersion, ReleaseScheduleEntry } from "./node.js";

export const CachedNodeData = Schema.Struct({
	versions: Schema.Array(NodeDistVersion),
	schedule: Schema.Record({
		key: Schema.String,
		value: ReleaseScheduleEntry,
	}),
});
export type CachedNodeData = typeof CachedNodeData.Type;

export const CachedTagData = Schema.Struct({
	tags: Schema.Array(GitHubTag),
});
export type CachedTagData = typeof CachedTagData.Type;
