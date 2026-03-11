import { Data, DateTime, Effect, Option } from "effect";
import type { NodePhase } from "./common.js";

/**
 * A single entry in the Node.js release schedule.
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
 * Raw schedule format as fetched from the Node.js Release repo.
 * Intermediate type between fetcher and NodeSchedule class.
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

const NodeScheduleBase = Data.TaggedClass("NodeSchedule");

/**
 * Immutable schedule holding all Node.js release schedule entries.
 * Lives in a `Ref<NodeSchedule>` singleton for shared mutable access.
 */
export class NodeSchedule extends NodeScheduleBase<{
	readonly entries: ReadonlyArray<NodeScheduleEntry>;
}> {
	/**
	 * Parse raw schedule JSON into a NodeSchedule instance.
	 * Converts date strings to DateTime and normalizes codenames.
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
	 * Determines the current phase of a Node.js major version.
	 * Returns null if the major is unknown or not yet released.
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
	 * Look up the schedule entry for a given major version.
	 */
	entryFor(major: number): Option.Option<NodeScheduleEntry> {
		const entry = this.entries.find((e) => e.major === major);
		return entry ? Option.some(entry) : Option.none();
	}
}
