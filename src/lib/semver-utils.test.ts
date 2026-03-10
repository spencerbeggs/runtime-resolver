import { describe, expect, it } from "vitest";
import { filterByIncrements, resolveVersionFromList } from "./semver-utils.js";

describe("filterByIncrements", () => {
	const versions = ["23.11.0", "23.10.5", "23.10.0", "22.21.0", "22.20.0", "20.18.1", "20.18.0"];

	it("returns all versions for 'patch'", () => {
		expect(filterByIncrements(versions, "patch")).toEqual(versions);
	});

	it("returns latest patch per minor for 'minor'", () => {
		const result = filterByIncrements(versions, "minor");
		expect(result).toContain("23.11.0");
		expect(result).toContain("23.10.5");
		expect(result).not.toContain("23.10.0");
		expect(result).toContain("22.21.0");
		expect(result).toContain("22.20.0");
		expect(result).toContain("20.18.1");
		expect(result).not.toContain("20.18.0");
	});

	it("returns latest per major for 'latest'", () => {
		const result = filterByIncrements(versions, "latest");
		expect(result).toEqual(["23.11.0", "22.21.0", "20.18.1"]);
	});

	it("handles empty array", () => {
		expect(filterByIncrements([], "latest")).toEqual([]);
	});
});

describe("resolveVersionFromList", () => {
	const versions = ["23.11.0", "23.10.0", "22.21.0", "20.18.1"];

	it("returns exact version as-is", () => {
		expect(resolveVersionFromList("22.21.0", versions)).toBe("22.21.0");
	});

	it("resolves caret range to latest match", () => {
		expect(resolveVersionFromList("^23.0.0", versions)).toBe("23.11.0");
	});

	it("resolves tilde range", () => {
		expect(resolveVersionFromList("~23.10.0", versions)).toBe("23.10.0");
	});

	it("resolves >= range", () => {
		expect(resolveVersionFromList(">=22.0.0", versions)).toBe("23.11.0");
	});

	it("returns undefined for no match", () => {
		expect(resolveVersionFromList("^99.0.0", versions)).toBeUndefined();
	});

	it("returns undefined for exact version not in list", () => {
		expect(resolveVersionFromList("99.99.99", ["1.0.0", "2.0.0"])).toBeUndefined();
	});

	it("returns exact version when it exists in list", () => {
		expect(resolveVersionFromList("2.0.0", ["1.0.0", "2.0.0", "3.0.0"])).toBe("2.0.0");
	});
});
