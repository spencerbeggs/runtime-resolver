import { Schema } from "effect";

export const Runtime = Schema.Literal("node", "bun", "deno");
export type Runtime = typeof Runtime.Type;

export const Source = Schema.Literal("api", "cache");
export type Source = typeof Source.Type;

export const Freshness = Schema.Literal("auto", "api", "cache");
export type Freshness = typeof Freshness.Type;

export const ResolvedVersions = Schema.Struct({
	source: Source,
	versions: Schema.Array(Schema.String),
	latest: Schema.String,
	lts: Schema.optional(Schema.String),
	default: Schema.optional(Schema.String),
});
export type ResolvedVersions = typeof ResolvedVersions.Type;

export const NodePhase = Schema.Literal("current", "active-lts", "maintenance-lts", "end-of-life");
export type NodePhase = typeof NodePhase.Type;

export const Increments = Schema.Literal("latest", "minor", "patch");
export type Increments = typeof Increments.Type;
