import { Schema } from "effect";

/**
 * A single entry in the Node.js distribution index
 * (`https://nodejs.org/dist/index.json`).
 *
 * Decoded by {@link NodeVersionFetcherLive} when fetching the full list of
 * available Node.js releases from the official distribution server.
 *
 * @internal
 */
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

/**
 * The decoded type of a single entry in the Node.js distribution index.
 *
 * @internal
 */
export type NodeDistVersion = typeof NodeDistVersion.Type;

/**
 * The full decoded body of `https://nodejs.org/dist/index.json`.
 *
 * Decoded by {@link NodeVersionFetcherLive} before being mapped into
 * {@link NodeRelease} instances.
 *
 * @internal
 */
export const NodeDistIndex = Schema.Array(NodeDistVersion);

/**
 * The full decoded body of `https://nodejs.org/dist/index.json`.
 *
 * @internal
 */
export type NodeDistIndex = typeof NodeDistIndex.Type;

/**
 * A single entry in the Node.js release schedule JSON fetched by
 * {@link NodeScheduleFetcherLive}.
 *
 * All date-like fields are optional because odd-numbered major lines
 * (e.g. v21) never enter LTS.
 *
 * @internal
 */
export const ReleaseScheduleEntry = Schema.Struct({
	start: Schema.String,
	lts: Schema.optional(Schema.String),
	maintenance: Schema.optional(Schema.String),
	end: Schema.String,
	codename: Schema.optional(Schema.String),
});

/**
 * The decoded type of a single entry in the Node.js release schedule JSON.
 *
 * @internal
 */
export type ReleaseScheduleEntry = typeof ReleaseScheduleEntry.Type;

/**
 * The full decoded body of the Node.js release schedule JSON fetched by
 * {@link NodeScheduleFetcherLive}.
 *
 * Keyed by major version string (e.g. `"v20"`); values are
 * {@link ReleaseScheduleEntry} objects. After decoding, this record is handed
 * to {@link NodeSchedule.fromData} to produce an immutable
 * {@link NodeSchedule}.
 *
 * @internal
 */
export const NodeReleaseSchedule = Schema.Record({
	key: Schema.String,
	value: ReleaseScheduleEntry,
});

/**
 * The full decoded type of the Node.js release schedule JSON.
 *
 * @internal
 */
export type NodeReleaseSchedule = typeof NodeReleaseSchedule.Type;
