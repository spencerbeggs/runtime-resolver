import { DateTime, Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "./node-schedule.js";
import { NodeSchedule } from "./node-schedule.js";

const scheduleData: NodeScheduleData = {
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

describe("NodeSchedule", () => {
	it("creates from raw schedule data", () => {
		const schedule = NodeSchedule.fromData(scheduleData);
		expect(schedule._tag).toBe("NodeSchedule");
		expect(schedule.entries.length).toBe(4);
	});

	it("normalizes codename to empty string when absent", () => {
		const schedule = NodeSchedule.fromData(scheduleData);
		const v23Entry = schedule.entries.find((e) => e.major === 23);
		expect(v23Entry?.codename).toBe("");
		const v24Entry = schedule.entries.find((e) => e.major === 24);
		expect(v24Entry?.codename).toBe("");
	});

	it("preserves codename when present", () => {
		const schedule = NodeSchedule.fromData(scheduleData);
		const v22Entry = schedule.entries.find((e) => e.major === 22);
		expect(v22Entry?.codename).toBe("Jod");
	});

	describe("phaseFor", () => {
		const schedule = NodeSchedule.fromData(scheduleData);

		it("returns 'current' before LTS date", () => {
			const now = DateTime.unsafeMake("2024-06-15");
			const phase = Effect.runSync(schedule.phaseFor(22, now));
			expect(phase).toBe("current");
		});

		it("returns 'active-lts' after LTS date", () => {
			const now = DateTime.unsafeMake("2024-11-15");
			const phase = Effect.runSync(schedule.phaseFor(22, now));
			expect(phase).toBe("active-lts");
		});

		it("returns 'maintenance-lts' after maintenance date", () => {
			const now = DateTime.unsafeMake("2025-11-15");
			const phase = Effect.runSync(schedule.phaseFor(22, now));
			expect(phase).toBe("maintenance-lts");
		});

		it("returns 'end-of-life' after end date", () => {
			const now = DateTime.unsafeMake("2027-05-01");
			const phase = Effect.runSync(schedule.phaseFor(22, now));
			expect(phase).toBe("end-of-life");
		});

		it("returns null before start date", () => {
			const now = DateTime.unsafeMake("2025-01-01");
			const phase = Effect.runSync(schedule.phaseFor(24, now));
			expect(phase).toBeNull();
		});

		it("returns null for unknown major", () => {
			const now = DateTime.unsafeMake("2025-01-01");
			const phase = Effect.runSync(schedule.phaseFor(99, now));
			expect(phase).toBeNull();
		});

		it("returns 'current' for odd version (never LTS)", () => {
			const now = DateTime.unsafeMake("2024-11-01");
			const phase = Effect.runSync(schedule.phaseFor(23, now));
			expect(phase).toBe("current");
		});
	});

	describe("entryFor", () => {
		const schedule = NodeSchedule.fromData(scheduleData);

		it("returns Some for known major", () => {
			const entry = schedule.entryFor(22);
			expect(entry._tag).toBe("Some");
		});

		it("returns None for unknown major", () => {
			const entry = schedule.entryFor(99);
			expect(entry._tag).toBe("None");
		});
	});
});
