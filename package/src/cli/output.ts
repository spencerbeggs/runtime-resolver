import type { NodePhase, ResolvedVersions, Runtime } from "@effected/runtimes";
import { Result } from "effect";

/**
 * The Node.js lifecycle phases a `--node-phases` value may name, mirroring the
 * kit's `NodePhase` vocabulary. Kept as a runtime tuple so the parser can both
 * validate against it and quote it back in an error message.
 */
export const NODE_PHASES = ["current", "active-lts", "maintenance-lts", "end-of-life"] as const;

/**
 * Parse the comma-separated `--node-phases` value into the kit's phase array.
 *
 * A malformed value is a usage error, not a data condition, so this returns a
 * `Result` whose failure is the operator-facing message the caller prints to
 * stderr before failing the process.
 */
export const parsePhases = (csv: string): Result.Result<ReadonlyArray<NodePhase>, string> => {
	const tokens = csv
		.split(",")
		.map((token) => token.trim())
		.filter((token) => token.length > 0);
	if (tokens.length === 0) {
		return Result.fail(`--node-phases was empty; expected any of: ${NODE_PHASES.join(", ")}`);
	}
	const known = new Set<string>(NODE_PHASES);
	const invalid = tokens.filter((token) => !known.has(token));
	if (invalid.length > 0) {
		return Result.fail(
			`invalid --node-phases value${invalid.length > 1 ? "s" : ""}: ${invalid.join(", ")}. Expected any of: ${NODE_PHASES.join(", ")}`,
		);
	}
	return Result.succeed(tokens as ReadonlyArray<NodePhase>);
};

/**
 * The JSON shape emitted for one runtime: the kit's `ResolvedVersions` fields,
 * with the two `optionalKey` fields present only when the resolver set them.
 */
export interface RuntimeOutput {
	readonly source: ResolvedVersions["source"];
	readonly versions: ReadonlyArray<string>;
	readonly latest: string;
	readonly lts?: string;
	readonly default?: string;
}

/**
 * Project a `ResolvedVersions` onto a plain object so the output is exactly the
 * kit's shape — no schema markers, and no explicit `undefined` for the optional
 * fields the resolver omitted.
 */
export const toPlain = (resolved: ResolvedVersions): RuntimeOutput => ({
	source: resolved.source,
	versions: resolved.versions,
	latest: resolved.latest,
	...(resolved.lts !== undefined ? { lts: resolved.lts } : {}),
	...(resolved.default !== undefined ? { default: resolved.default } : {}),
});

/**
 * Render the resolution output as JSON.
 *
 * A single requested runtime emits its `ResolvedVersions` directly; several
 * emit an object keyed by runtime name, in the order the entries were supplied.
 * `pretty` selects 2-space indentation over the compact default.
 */
export const formatOutput = (entries: ReadonlyArray<readonly [Runtime, ResolvedVersions]>, pretty: boolean): string => {
	const payload =
		entries.length === 1
			? toPlain(entries[0][1])
			: Object.fromEntries(entries.map(([runtime, resolved]) => [runtime, toPlain(resolved)]));
	return JSON.stringify(payload, null, pretty ? 2 : undefined);
};
