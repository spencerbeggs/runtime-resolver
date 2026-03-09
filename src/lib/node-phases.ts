import * as semver from "semver";
import type { NodePhase } from "../schemas/common.js";
import type { NodeReleaseSchedule } from "../schemas/node.js";

/**
 * Determines the current phase of a Node.js version based on the release schedule.
 *
 * Phases are determined by comparing the provided date against the release schedule:
 * - Before start date: returns null (not yet released)
 * - After end date: returns "end-of-life"
 * - After maintenance date: returns "maintenance-lts"
 * - After lts date: returns "active-lts"
 * - Otherwise: returns "current"
 *
 * When the schedule indicates a version should be LTS (lts date has passed)
 * but the dist index hasn't tagged it yet, this function trusts the schedule.
 */
export function getVersionPhase(
	version: string,
	schedule: NodeReleaseSchedule,
	now: Date = new Date(),
): NodePhase | null {
	const major = semver.major(version);
	const majorKey = `v${major}`;
	const versionSchedule = schedule[majorKey];

	if (!versionSchedule) {
		return null;
	}

	const startDate = new Date(versionSchedule.start);
	const ltsDate = versionSchedule.lts ? new Date(versionSchedule.lts) : null;
	const maintenanceDate = versionSchedule.maintenance ? new Date(versionSchedule.maintenance) : null;
	const endDate = new Date(versionSchedule.end);

	if (now < startDate) {
		return null;
	}

	if (now >= endDate) {
		return "end-of-life";
	}

	if (maintenanceDate && now >= maintenanceDate) {
		return "maintenance-lts";
	}

	if (ltsDate && now >= ltsDate) {
		return "active-lts";
	}

	return "current";
}

/**
 * Returns the latest LTS version from the schedule that is currently in
 * active-lts or maintenance-lts phase.
 */
export function findLatestLts(
	versions: string[],
	schedule: NodeReleaseSchedule,
	now: Date = new Date(),
): string | undefined {
	const ltsVersions = versions.filter((v) => {
		const phase = getVersionPhase(v, schedule, now);
		return phase === "active-lts" || phase === "maintenance-lts";
	});

	if (ltsVersions.length === 0) return undefined;

	return semver.rsort([...ltsVersions])[0];
}
