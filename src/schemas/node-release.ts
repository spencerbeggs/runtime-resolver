import { DateTime, Effect, Ref, Schema } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { NodePhase } from "./common.js";
import type { NodeSchedule } from "./node-schedule.js";

/**
 * Lean input schema used to construct {@link NodeRelease} instances from
 * bundled default data files and the Node.js dist API response.
 *
 * The `version` and `npm` fields are raw version strings validated by
 * `SemVer.fromString`; `date` is a date string accepted by
 * `DateTime.unsafeMake`.
 *
 * @see {@link NodeRelease.fromInput}
 * @see {@link NodeVersionFetcher}
 *
 * @public
 */
export const NodeReleaseInput = Schema.Struct({
	version: Schema.String,
	npm: Schema.String,
	date: Schema.String,
});

/**
 * Lean input type used to construct {@link NodeRelease} instances.
 *
 * @see {@link NodeRelease.fromInput}
 *
 * @public
 */
export type NodeReleaseInput = typeof NodeReleaseInput.Type;

/**
 * A Node.js release entry with parsed version, bundled npm version,
 * publication date, and a shared reference to the Node.js release schedule.
 *
 * `NodeRelease` is a plain class rather than a `Data.TaggedClass` because it
 * holds a `Ref<NodeSchedule>` — mutable Effect references break structural
 * equality semantics, making `Data.TaggedClass` unsuitable here. The
 * `_tag` field is set manually to preserve tagged-union compatibility.
 *
 * Use {@link NodeRelease.fromInput} to construct instances; call
 * {@link NodeRelease.phase} or {@link NodeRelease.lts} to query the lifecycle
 * state of the release at a given point in time.
 *
 * @see {@link NodeReleaseCache}
 * @see {@link NodeResolver}
 * @see {@link NodeSchedule}
 *
 * @example
 * ```typescript
 * import { Effect, Ref } from "effect";
 * import type { NodePhase } from "./common.js";
 * import type { NodeRelease } from "./node-release.js";
 * import { NodeRelease as NodeReleaseClass } from "./node-release.js";
 * import { NodeSchedule } from "./node-schedule.js";
 *
 * const program = Effect.gen(function* () {
 *   const schedule = NodeSchedule.fromData({
 *     v20: { start: "2023-04-18", lts: "2023-10-24", end: "2026-04-30" },
 *   });
 *   const scheduleRef = yield* Ref.make(schedule);
 *
 *   const release: NodeRelease = yield* NodeReleaseClass.fromInput(
 *     { version: "v20.0.0", npm: "9.6.4", date: "2023-04-18" },
 *     scheduleRef,
 *   );
 *
 *   const phase: NodePhase | null = yield* release.phase();
 *   const isLts: boolean = yield* release.lts();
 *   console.log(phase);  // e.g. "active-lts"
 *   console.log(isLts);  // true
 * });
 *
 * Effect.runPromise(program);
 * ```
 *
 * @public
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
	 * Determine this release's lifecycle phase at the given point in time.
	 *
	 * Reads the current value of the shared `scheduleRef` and delegates to
	 * {@link NodeSchedule.phaseFor}. Defaults to the current wall-clock time
	 * when `now` is omitted.
	 *
	 * @param now - Optional reference time; defaults to `new Date()`.
	 * @returns An `Effect` that resolves to a {@link NodePhase} string, or
	 *   `null` when the major version is not present in the schedule or has
	 *   not yet been released.
	 */
	phase(now?: DateTime.DateTime): Effect.Effect<NodePhase | null> {
		const effectiveNow = now ?? DateTime.unsafeMake(new Date());
		return Effect.gen(this, function* () {
			const schedule = yield* Ref.get(this.scheduleRef);
			return yield* schedule.phaseFor(this.version.major, effectiveNow);
		});
	}

	/**
	 * Whether this release is currently in Long-Term Support.
	 *
	 * Returns `true` for both `"active-lts"` and `"maintenance-lts"` phases.
	 * Defaults to the current wall-clock time when `now` is omitted.
	 *
	 * @param now - Optional reference time; defaults to `new Date()`.
	 */
	lts(now?: DateTime.DateTime): Effect.Effect<boolean> {
		return this.phase(now).pipe(Effect.map((p) => p === "active-lts" || p === "maintenance-lts"));
	}

	/**
	 * Create a {@link NodeRelease} from lean string inputs.
	 *
	 * Parses `input.version` and `input.npm` via `SemVer.fromString` and
	 * constructs the publication date with `DateTime.unsafeMake`.
	 *
	 * @param input - A {@link NodeReleaseInput} object with raw string fields.
	 * @param scheduleRef - A shared `Ref<NodeSchedule>` injected by the cache layer.
	 * @returns An `Effect` that succeeds with a `NodeRelease` or fails with an
	 *   `InvalidVersionError` when either version string cannot be parsed.
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
