import { DateTime, Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

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

const nodeInputs = [
	{ version: "24.0.0", npm: "11.0.0", date: "2025-04-22" },
	{ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" },
	{ version: "22.10.0", npm: "10.8.0", date: "2024-10-01" },
];

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const TestLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

describe("NodeReleaseCacheLive", () => {
	it("loads from inputs and returns releases", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			yield* cache.updateSchedule(scheduleData);
			yield* cache.loadFromInputs(nodeInputs);
			const all = yield* cache.releases();
			expect(all.length).toBe(3);
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});

	it("returns LTS releases", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			yield* cache.updateSchedule(scheduleData);
			yield* cache.loadFromInputs(nodeInputs);
			const lts = yield* cache.ltsReleases(DateTime.unsafeMake("2025-01-15"));
			// v22 should be active-lts at this point
			expect(lts.length).toBeGreaterThan(0);
			for (const r of lts) {
				expect(r.version.major).toBe(22);
			}
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});

	it("returns current releases", async () => {
		const program = Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			yield* cache.updateSchedule(scheduleData);
			yield* cache.loadFromInputs(nodeInputs);
			const current = yield* cache.currentReleases(DateTime.unsafeMake("2025-06-01"));
			// v24 should be "current" at this point
			expect(current.length).toBeGreaterThan(0);
			for (const r of current) {
				expect(r.version.major).toBe(24);
			}
		});
		await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
	});
});
