import { Data, DateTime, Effect, Option } from "effect";
import type { NodePhase } from "./common.js";

/**
 * A single entry in the Node.js release schedule, representing one major
 * release line's lifecycle dates and optional LTS codename.
 *
 * All date fields have already been converted from ISO strings to Effect
 * `DateTime.DateTime` values by {@link NodeSchedule.fromData}.
 *
 * @see {@link NodeSchedule}
 * @see {@link NodeSchedule.phaseFor}
 *
 * @public
 */
export interface NodeScheduleEntry {
	readonly major: number;
	readonly start: DateTime.DateTime;
	readonly lts: DateTime.DateTime | null;
	readonly maintenance: DateTime.DateTime | null;
	readonly end: DateTime.DateTime;
	readonly codename: string;
}

/**
 * Raw schedule format as fetched from the Node.js Release GitHub repository
 * (`nodejs/Release`).
 *
 * This is the intermediate type between the {@link NodeScheduleFetcher} layer
 * and the {@link NodeSchedule} class. Date values are plain ISO strings; the
 * `NodeSchedule.fromData` factory converts them to `DateTime`.
 *
 * @see {@link NodeSchedule.fromData}
 * @see {@link NodeScheduleFetcher}
 *
 * @public
 */
export type NodeScheduleData = Record<
	string,
	{
		readonly start: string;
		readonly lts?: string;
		readonly maintenance?: string;
		readonly end: string;
		readonly codename?: string;
	}
>;

/**
 * Immutable snapshot of the Node.js release schedule.
 *
 * Holds a `ReadonlyArray<NodeScheduleEntry>` parsed from the raw
 * {@link NodeScheduleData} fetched by {@link NodeScheduleFetcher}. A single
 * `NodeSchedule` instance lives inside a `Ref<NodeSchedule>` that is shared
 * across all {@link NodeRelease} instances so that schedule updates propagate
 * without rebuilding the release cache.
 *
 * `NodeSchedule` extends `Data.TaggedClass` and therefore supports structural
 * equality — two schedules built from identical data compare as equal.
 *
 * @see {@link NodeRelease}
 * @see {@link NodeScheduleFetcher}
 *
 * @example
 * ```typescript
 * import { Effect } from "effect";
 * import type { NodePhase } from "./common.js";
 * import type { NodeScheduleData } from "./node-schedule.js";
 * import { NodeSchedule } from "./node-schedule.js";
 *
 * const data: NodeScheduleData = {
 *   v20: {
 *     start: "2023-04-18",
 *     lts: "2023-10-24",
 *     maintenance: "2024-10-22",
 *     end: "2026-04-30",
 *     codename: "Iron",
 *   },
 * };
 *
 * const schedule = NodeSchedule.fromData(data);
 *
 * const program = schedule.phaseFor(20, new Date("2024-01-01") as any).pipe(
 *   Effect.map((phase: NodePhase | null) => {
 *     console.log(phase); // "active-lts"
 *   }),
 * );
 *
 * Effect.runPromise(program);
 * ```
 *
 * @public
 */
export class NodeSchedule extends Data.TaggedClass("NodeSchedule")<{
	readonly entries: ReadonlyArray<NodeScheduleEntry>;
}> {
	/**
	 * Parse raw {@link NodeScheduleData} into a `NodeSchedule` instance.
	 *
	 * Iterates over every key of the form `"vNN"`, converts ISO date strings
	 * to `DateTime.DateTime`, and normalises missing codenames to `""`.
	 *
	 * @param data - The raw JSON object fetched from the Node.js release repo.
	 * @returns A fully constructed, immutable `NodeSchedule`.
	 */
	static fromData(data: NodeScheduleData): NodeSchedule {
		const entries: NodeScheduleEntry[] = [];
		for (const [key, value] of Object.entries(data)) {
			const major = Number.parseInt(key.replace("v", ""), 10);
			if (Number.isNaN(major)) continue;
			entries.push({
				major,
				start: DateTime.unsafeMake(value.start),
				lts: value.lts ? DateTime.unsafeMake(value.lts) : null,
				maintenance: value.maintenance ? DateTime.unsafeMake(value.maintenance) : null,
				end: DateTime.unsafeMake(value.end),
				codename: value.codename ?? "",
			});
		}
		return new NodeSchedule({ entries });
	}

	/**
	 * Determine the current {@link NodePhase} for a given major version number
	 * at the specified point in time.
	 *
	 * Returns `null` when the major is not present in the schedule or when
	 * `now` is before the release's start date.
	 *
	 * @param major - The Node.js major version number (e.g. `20`).
	 * @param now - The reference `DateTime` against which phases are evaluated.
	 */
	phaseFor(major: number, now: DateTime.DateTime): Effect.Effect<NodePhase | null> {
		return Effect.sync(() => {
			const entry = this.entries.find((e) => e.major === major);
			if (!entry) return null;

			if (DateTime.lessThan(now, entry.start)) return null;
			if (DateTime.greaterThanOrEqualTo(now, entry.end)) return "end-of-life";
			if (entry.maintenance && DateTime.greaterThanOrEqualTo(now, entry.maintenance)) return "maintenance-lts";
			if (entry.lts && DateTime.greaterThanOrEqualTo(now, entry.lts)) return "active-lts";
			return "current";
		});
	}

	/**
	 * Look up the {@link NodeScheduleEntry} for a given major version number.
	 *
	 * Returns `Option.none()` when the major is not present in the schedule.
	 *
	 * @param major - The Node.js major version number (e.g. `20`).
	 */
	entryFor(major: number): Option.Option<NodeScheduleEntry> {
		const entry = this.entries.find((e) => e.major === major);
		return entry ? Option.some(entry) : Option.none();
	}
}
