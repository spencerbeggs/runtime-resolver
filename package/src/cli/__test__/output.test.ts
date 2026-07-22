import { describe, expect, it } from "@effect/vitest";
import type { ResolvedVersions } from "@effected/runtimes";
import { Result } from "effect";
import { NODE_PHASES, formatOutput, parsePhases, toPlain } from "../output.js";

/** A minimal `ResolvedVersions`-shaped fixture; only the fields the helpers read. */
const resolved = (fields: Partial<ResolvedVersions>): ResolvedVersions =>
	({ source: "cache", versions: ["1.0.0"], latest: "1.0.0", ...fields }) as ResolvedVersions;

describe("parsePhases", () => {
	it("accepts a single valid phase", () => {
		const result = parsePhases("active-lts");
		expect(Result.isSuccess(result)).toBe(true);
		expect(Result.getOrElse(result, () => [])).toEqual(["active-lts"]);
	});

	it("accepts several valid phases and trims whitespace", () => {
		const result = parsePhases(" current , maintenance-lts ,end-of-life");
		expect(Result.getOrElse(result, () => [])).toEqual(["current", "maintenance-lts", "end-of-life"]);
	});

	it("rejects an unknown phase and names it", () => {
		const result = parsePhases("current,bogus");
		expect(Result.isFailure(result)).toBe(true);
		if (Result.isFailure(result)) {
			expect(result.failure).toContain("bogus");
			expect(result.failure).toContain("current, active-lts, maintenance-lts, end-of-life");
		}
	});

	it("pluralizes the message for multiple invalid phases", () => {
		const result = parsePhases("nope,nada");
		if (Result.isFailure(result)) {
			expect(result.failure).toContain("values");
			expect(result.failure).toContain("nope, nada");
		}
	});

	it("rejects an empty value", () => {
		expect(Result.isFailure(parsePhases(""))).toBe(true);
		expect(Result.isFailure(parsePhases("  , ,"))).toBe(true);
	});

	it("covers exactly the kit's phase vocabulary", () => {
		for (const phase of NODE_PHASES) {
			expect(Result.isSuccess(parsePhases(phase))).toBe(true);
		}
	});
});

describe("toPlain", () => {
	it("omits optional fields the resolver did not set", () => {
		expect(toPlain(resolved({ source: "api", versions: ["20.1.0"], latest: "20.1.0" }))).toEqual({
			source: "api",
			versions: ["20.1.0"],
			latest: "20.1.0",
		});
	});

	it("includes lts and default when present", () => {
		const plain = toPlain(resolved({ latest: "20.1.0", lts: "20.0.0", default: "18.0.0" }));
		expect(plain).toEqual({ source: "cache", versions: ["1.0.0"], latest: "20.1.0", lts: "20.0.0", default: "18.0.0" });
	});
});

describe("formatOutput", () => {
	it("emits a single runtime's ResolvedVersions directly", () => {
		const json = formatOutput([["node", resolved({ latest: "20.1.0" })]], false);
		expect(JSON.parse(json)).toEqual({ source: "cache", versions: ["1.0.0"], latest: "20.1.0" });
	});

	it("keys by runtime name when several are requested, preserving order", () => {
		const json = formatOutput(
			[
				["node", resolved({ latest: "20.1.0" })],
				["bun", resolved({ latest: "1.2.0" })],
			],
			false,
		);
		expect(Object.keys(JSON.parse(json))).toEqual(["node", "bun"]);
		expect(JSON.parse(json).bun.latest).toBe("1.2.0");
	});

	it("pretty-prints with newlines only when asked", () => {
		const entries = [["node", resolved({})]] as const;
		expect(formatOutput(entries, false)).not.toContain("\n");
		expect(formatOutput(entries, true)).toContain("\n");
	});
});
