import { DateTime, Effect, Ref, Schema } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { NodePhase } from "./common.js";
import type { NodeSchedule } from "./node-schedule.js";

/**
 * Lean input schema for NodeRelease construction.
 * This is the shape the defaults generator writes.
 */
export const NodeReleaseInput = Schema.Struct({
	version: Schema.String,
	npm: Schema.String,
	date: Schema.String,
});
export type NodeReleaseInput = typeof NodeReleaseInput.Type;

/**
 * A Node.js release with parsed SemVer version and DateTime date.
 *
 * Plain class (not Data.TaggedClass) because it holds a Ref<NodeSchedule>
 * which would break structural equality semantics. Uses manual _tag field.
 */
export class NodeRelease {
	readonly _tag = "NodeRelease" as const;

	constructor(
		readonly version: SemVer.SemVer,
		readonly npm: SemVer.SemVer,
		readonly date: DateTime.DateTime,
		readonly scheduleRef: Ref.Ref<NodeSchedule>,
	) {}

	/**
	 * Determine this release's lifecycle phase at the given time.
	 * Reads from the shared schedule Ref.
	 */
	phase(now?: DateTime.DateTime): Effect.Effect<NodePhase | null> {
		const effectiveNow = now ?? DateTime.unsafeMake(new Date());
		return Effect.gen(this, function* () {
			const schedule = yield* Ref.get(this.scheduleRef);
			return yield* schedule.phaseFor(this.version.major, effectiveNow);
		});
	}

	/**
	 * Whether this release is currently LTS (active-lts or maintenance-lts).
	 */
	lts(now?: DateTime.DateTime): Effect.Effect<boolean> {
		return this.phase(now).pipe(Effect.map((p) => p === "active-lts" || p === "maintenance-lts"));
	}

	/**
	 * Create a NodeRelease from lean input strings.
	 * Parses version/npm via SemVer.fromString, date via DateTime.
	 */
	static fromInput(
		input: NodeReleaseInput,
		scheduleRef: Ref.Ref<NodeSchedule>,
	): Effect.Effect<NodeRelease, InvalidVersionError> {
		return Effect.gen(function* () {
			const version = yield* SemVer.fromString(input.version);
			const npm = yield* SemVer.fromString(input.npm);
			const date = DateTime.unsafeMake(input.date);
			return new NodeRelease(version, npm, date, scheduleRef);
		});
	}
}
