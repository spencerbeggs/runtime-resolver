import { Effect, Option } from "effect";
import { Range, SemVer } from "semver-effect";
import type { Increments } from "../schemas/common.js";

/**
 * Tries to parse a version string, returning Option.
 */
function parseSemVer(input: string): Option.Option<SemVer.SemVer> {
	return Effect.runSync(
		SemVer.fromString(input).pipe(
			Effect.map(Option.some),
			Effect.orElseSucceed(() => Option.none()),
		),
	);
}

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
		const minorGroups = new Map<string, { version: string; parsed: SemVer.SemVer }[]>();
		for (const version of versions) {
			const opt = parseSemVer(version);
			if (Option.isNone(opt)) continue;
			const parsed = opt.value;

			const minorKey = `${parsed.major}.${parsed.minor}`;
			const group = minorGroups.get(minorKey);
			if (group) {
				group.push({ version, parsed });
			} else {
				minorGroups.set(minorKey, [{ version, parsed }]);
			}
		}

		const filtered: string[] = [];
		for (const group of minorGroups.values()) {
			const sorted = group.map((g) => g.parsed);
			const best = SemVer.rsort(sorted)[0];
			filtered.push(best.toString());
		}
		return filtered;
	}

	// increment === "latest"
	const majorGroups = new Map<number, { version: string; parsed: SemVer.SemVer }[]>();
	for (const version of versions) {
		const opt = parseSemVer(version);
		if (Option.isNone(opt)) continue;
		const parsed = opt.value;

		const group = majorGroups.get(parsed.major);
		if (group) {
			group.push({ version, parsed });
		} else {
			majorGroups.set(parsed.major, [{ version, parsed }]);
		}
	}

	const filtered: string[] = [];
	for (const group of majorGroups.values()) {
		const sorted = group.map((g) => g.parsed);
		const best = SemVer.rsort(sorted)[0];
		filtered.push(best.toString());
	}
	return filtered;
}

/**
 * Resolves a semver range to the latest matching version from a list.
 * If the input is already a specific version, returns it as-is.
 */
export function resolveVersionFromList(versionOrRange: string, versions: string[]): string | undefined {
	// Check if it's an exact version
	const exactOpt = parseSemVer(versionOrRange);
	if (Option.isSome(exactOpt)) {
		return versions.includes(versionOrRange) ? versionOrRange : undefined;
	}

	// Try to parse as range
	const rangeResult = Effect.runSync(
		Range.fromString(versionOrRange).pipe(
			Effect.map(Option.some),
			Effect.orElseSucceed(() => Option.none()),
		),
	);
	if (Option.isNone(rangeResult)) return undefined;
	const range = rangeResult.value;

	const parsed: SemVer.SemVer[] = [];
	for (const v of versions) {
		const opt = parseSemVer(v);
		if (Option.isSome(opt) && Range.satisfies(opt.value, range)) {
			parsed.push(opt.value);
		}
	}

	if (parsed.length === 0) return undefined;

	return SemVer.rsort(parsed)[0].toString();
}
