import { describe, expect, it } from "vitest";
import type { NodeReleaseSchedule } from "../schemas/node.js";
import { findLatestLts, getVersionPhase } from "./node-phases.js";

const schedule: NodeReleaseSchedule = {
	v20: {
		start: "2023-04-18",
		lts: "2023-10-24",
		maintenance: "2024-10-22",
		end: "2026-04-30",
		codename: "Iron",
	},
	v22: {
		start: "2024-04-24",
		lts: "2024-10-29",
		maintenance: "2025-10-21",
		end: "2027-04-30",
		codename: "Jod",
	},
	v23: {
		start: "2024-10-16",
		end: "2025-06-01",
	},
	v24: {
		start: "2025-04-22",
		lts: "2025-10-28",
		maintenance: "2026-10-20",
		end: "2028-04-30",
	},
};

describe("getVersionPhase", () => {
	it("returns 'current' for a version before its LTS date", () => {
		const phase = getVersionPhase("22.0.0", schedule, new Date("2024-06-15"));
		expect(phase).toBe("current");
	});

	it("returns 'active-lts' after LTS date", () => {
		const phase = getVersionPhase("22.11.0", schedule, new Date("2024-11-15"));
		expect(phase).toBe("active-lts");
	});

	it("returns 'maintenance-lts' after maintenance date", () => {
		const phase = getVersionPhase("22.11.0", schedule, new Date("2025-11-15"));
		expect(phase).toBe("maintenance-lts");
	});

	it("returns 'end-of-life' after end date", () => {
		const phase = getVersionPhase("22.11.0", schedule, new Date("2027-05-01"));
		expect(phase).toBe("end-of-life");
	});

	it("returns null for unreleased version", () => {
		const phase = getVersionPhase("24.0.0", schedule, new Date("2025-01-01"));
		expect(phase).toBeNull();
	});

	it("returns null for version not in schedule", () => {
		const phase = getVersionPhase("99.0.0", schedule, new Date("2025-01-01"));
		expect(phase).toBeNull();
	});

	it("returns 'current' for odd version (never LTS)", () => {
		const phase = getVersionPhase("23.0.0", schedule, new Date("2024-11-01"));
		expect(phase).toBe("current");
	});

	it("handles LTS timing gap - trusts schedule over dist index", () => {
		// v22 LTS date is 2024-10-29, testing right after
		const phase = getVersionPhase("22.9.0", schedule, new Date("2024-10-30"));
		expect(phase).toBe("active-lts");
	});
});

describe("findLatestLts", () => {
	it("returns the latest LTS version", () => {
		const versions = ["23.11.0", "22.11.0", "20.18.0"];
		const lts = findLatestLts(versions, schedule, new Date("2025-01-15"));
		expect(lts).toBe("22.11.0");
	});

	it("returns undefined when no LTS versions exist", () => {
		const versions = ["23.11.0"];
		const lts = findLatestLts(versions, schedule, new Date("2025-01-15"));
		expect(lts).toBeUndefined();
	});

	it("picks highest LTS when multiple exist", () => {
		const versions = ["22.11.0", "20.18.0"];
		const lts = findLatestLts(versions, schedule, new Date("2025-01-15"));
		expect(lts).toBe("22.11.0");
	});
});
