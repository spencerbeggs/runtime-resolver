import { describe, expect, it } from "vitest";
import { normalizeBunTag, normalizeDenoTag } from "./tag-normalizers.js";

describe("normalizeBunTag", () => {
	it("strips 'bun-' prefix and returns semver", () => {
		expect(normalizeBunTag("bun-v1.2.3")).toBe("1.2.3");
	});

	it("handles early releases with just 'v' prefix", () => {
		expect(normalizeBunTag("v0.1.0")).toBe("0.1.0");
	});

	it("returns null for non-semver tags", () => {
		expect(normalizeBunTag("canary")).toBeNull();
	});

	it("returns null for 'not-quite-v0'", () => {
		expect(normalizeBunTag("not-quite-v0")).toBeNull();
	});

	it("handles prerelease tags", () => {
		expect(normalizeBunTag("bun-v1.0.0-rc.1")).toBe("1.0.0-rc.1");
	});
});

describe("normalizeDenoTag", () => {
	it("strips 'v' prefix and returns semver", () => {
		expect(normalizeDenoTag("v2.7.3")).toBe("2.7.3");
	});

	it("returns null for non-semver tags", () => {
		expect(normalizeDenoTag("latest")).toBeNull();
	});

	it("handles 1.x tags", () => {
		expect(normalizeDenoTag("v1.40.0")).toBe("1.40.0");
	});
});
