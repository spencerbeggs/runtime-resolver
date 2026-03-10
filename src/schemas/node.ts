import { Schema } from "effect";

export const NodeDistVersion = Schema.Struct({
	version: Schema.String,
	date: Schema.String,
	files: Schema.Array(Schema.String),
	npm: Schema.optional(Schema.String),
	v8: Schema.optional(Schema.String),
	uv: Schema.optional(Schema.String),
	zlib: Schema.optional(Schema.String),
	openssl: Schema.optional(Schema.String),
	modules: Schema.optional(Schema.String),
	lts: Schema.Union(Schema.Literal(false), Schema.String),
	security: Schema.Boolean,
});
export type NodeDistVersion = typeof NodeDistVersion.Type;

export const NodeDistIndex = Schema.Array(NodeDistVersion);
export type NodeDistIndex = typeof NodeDistIndex.Type;

export const ReleaseScheduleEntry = Schema.Struct({
	start: Schema.String,
	lts: Schema.optional(Schema.String),
	maintenance: Schema.optional(Schema.String),
	end: Schema.String,
	codename: Schema.optional(Schema.String),
});
export type ReleaseScheduleEntry = typeof ReleaseScheduleEntry.Type;

export const NodeReleaseSchedule = Schema.Record({
	key: Schema.String,
	value: ReleaseScheduleEntry,
});
export type NodeReleaseSchedule = typeof NodeReleaseSchedule.Type;
