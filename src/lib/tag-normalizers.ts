import { Effect } from "effect";
import { SemVer } from "semver-effect";

/**
 * Strips a leading "v" or "V" prefix from a version string.
 */
function stripVPrefix(input: string): string {
	return input.startsWith("v") || input.startsWith("V") ? input.slice(1) : input;
}

/**
 * Tries to parse a string as a valid semver version.
 * Returns the normalized version string or null if invalid.
 */
function tryParseSemVer(input: string): string | null {
	const stripped = stripVPrefix(input);
	return Effect.runSync(
		SemVer.fromString(stripped).pipe(
			Effect.map((v) => v.toString()),
			Effect.orElseSucceed(() => null),
		),
	);
}

/**
 * Normalizes a Bun tag name to a valid semantic version.
 *
 * Bun uses different tag naming patterns:
 * - Modern releases: "bun-v1.2.3"
 * - Early releases: "v0.1.0"
 * - Development tags: "canary", "not-quite-v0"
 *
 * Strips the "bun-" prefix and validates the result is valid semver.
 */
export function normalizeBunTag(tagName: string): string | null {
	const version = tagName.startsWith("bun-") ? tagName.slice(4) : tagName;
	return tryParseSemVer(version);
}

/**
 * Normalizes a Deno tag name to a valid semantic version.
 *
 * Deno uses standard "v\{semver\}" format (e.g., "v2.7.3").
 * Strips the "v" prefix and validates the result is valid semver.
 */
export function normalizeDenoTag(tagName: string): string | null {
	return tryParseSemVer(tagName);
}
