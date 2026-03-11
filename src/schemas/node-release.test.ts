import { DateTime, Effect, Ref, Schema } from "effect";
import { describe, expect, it } from "vitest";
import { NodeRelease, NodeReleaseInput } from "./node-release.js";
import type { NodeScheduleData } from "./node-schedule.js";
import { NodeSchedule } from "./node-schedule.js";

const scheduleData: NodeScheduleData = {
	v22: {
		start: "2024-04-24",
		lts: "2024-10-29",
		maintenance: "2025-10-21",
		end: "2027-04-30",
		codename: "Jod",
	},
	v24: {
		start: "2025-04-22",
		lts: "2025-10-28",
		maintenance: "2026-10-20",
		end: "2028-04-30",
	},
};

describe("NodeReleaseInput", () => {
	it("decodes a valid input", () => {
		const result = Schema.decodeUnknownSync(NodeReleaseInput)({
			version: "22.11.0",
			npm: "10.9.0",
			date: "2024-11-15",
		});
		expect(result.version).toBe("22.11.0");
		expect(result.npm).toBe("10.9.0");
		expect(result.date).toBe("2024-11-15");
	});
});

describe("NodeRelease", () => {
	const makeRef = () => Effect.runSync(Ref.make(NodeSchedule.fromData(scheduleData)));

	it("creates from valid input", () => {
		const ref = makeRef();
		const release = Effect.runSync(
			NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
		);
		expect(release._tag).toBe("NodeRelease");
		expect(release.version.major).toBe(22);
		expect(release.version.minor).toBe(11);
		expect(release.npm.major).toBe(10);
	});

	it("fails on invalid version string", () => {
		const ref = makeRef();
		const result = Effect.runSyncExit(
			NodeRelease.fromInput({ version: "not-valid", npm: "10.9.0", date: "2024-11-15" }, ref),
		);
		expect(result._tag).toBe("Failure");
	});

	it("computes phase from schedule ref", () => {
		const ref = makeRef();
		const release = Effect.runSync(
			NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
		);
		const phase = Effect.runSync(release.phase(DateTime.unsafeMake("2025-01-15")));
		expect(phase).toBe("active-lts");
	});

	it("computes lts status", () => {
		const ref = makeRef();
		const release = Effect.runSync(
			NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
		);
		const isLts = Effect.runSync(release.lts(DateTime.unsafeMake("2025-01-15")));
		expect(isLts).toBe(true);
	});

	it("phase reads updated schedule via Ref", () => {
		const ref = makeRef();
		const release = Effect.runSync(
			NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
		);

		// Update schedule to make v22 end-of-life immediately
		Effect.runSync(
			Ref.set(
				ref,
				NodeSchedule.fromData({
					v22: {
						start: "2024-04-24",
						lts: "2024-10-29",
						maintenance: "2025-10-21",
						end: "2025-01-01",
						codename: "Jod",
					},
				}),
			),
		);

		const phase = Effect.runSync(release.phase(DateTime.unsafeMake("2025-01-15")));
		expect(phase).toBe("end-of-life");
	});
});
