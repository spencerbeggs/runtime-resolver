import * as semver from "semver";
import type { Increments } from "../schemas/common.js";

/**
 * Filters versions based on increment granularity.
 *
 * - "patch": Returns all versions (no filtering)
 * - "minor": Groups by major.minor, returns latest patch of each minor
 * - "latest": Groups by major, returns only the latest version of each major
 */
export function filterByIncrements(versions: string[], increment: Increments): string[] {
	if (increment === "patch") {
		return versions;
	}

	if (increment === "minor") {
		const minorGroups = new Map<string, string[]>();
		for (const version of versions) {
			const parsed = semver.parse(version);
			if (!parsed) continue;

			const minorKey = `${parsed.major}.${parsed.minor}`;
			const group = minorGroups.get(minorKey);
			if (group) {
				group.push(version);
			} else {
				minorGroups.set(minorKey, [version]);
			}
		}

		const filtered: string[] = [];
		for (const minorVersions of minorGroups.values()) {
			filtered.push(semver.rsort(minorVersions)[0]);
		}
		return filtered;
	}

	// increment === "latest"
	const majorGroups = new Map<number, string[]>();
	for (const version of versions) {
		const major = semver.major(version);
		const group = majorGroups.get(major);
		if (group) {
			group.push(version);
		} else {
			majorGroups.set(major, [version]);
		}
	}

	const filtered: string[] = [];
	for (const majorVersions of majorGroups.values()) {
		filtered.push(semver.rsort(majorVersions)[0]);
	}
	return filtered;
}

/**
 * Resolves a semver range to the latest matching version from a list.
 * If the input is already a specific version, returns it as-is.
 */
export function resolveVersionFromList(versionOrRange: string, versions: string[]): string | undefined {
	if (semver.valid(versionOrRange)) {
		return versionOrRange;
	}

	const matching = versions.filter((v) => semver.satisfies(v, versionOrRange));

	if (matching.length === 0) return undefined;

	return semver.rsort([...matching])[0];
}
