import * as semver from "semver";

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
	const parsed = semver.valid(version);
	return parsed ?? null;
}

/**
 * Normalizes a Deno tag name to a valid semantic version.
 *
 * Deno uses standard "v\{semver\}" format (e.g., "v2.7.3").
 * Strips the "v" prefix and validates the result is valid semver.
 */
export function normalizeDenoTag(tagName: string): string | null {
	const parsed = semver.valid(tagName);
	return parsed ?? null;
}
