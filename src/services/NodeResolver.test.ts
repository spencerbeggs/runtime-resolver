import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { NodeReleaseCacheLive } from "../layers/NodeReleaseCacheLive.js";
import { NodeResolverLive } from "../layers/NodeResolverLive.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeResolver } from "./NodeResolver.js";

const scheduleData: NodeScheduleData = {
	v18: {
		start: "2022-04-19",
		lts: "2022-10-25",
		maintenance: "2023-10-18",
		end: "2025-04-30",
		codename: "Hydrogen",
	},
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

const nodeInputs = [
	{ version: "24.0.0", npm: "11.0.0", date: "2025-04-22" },
	{ version: "23.11.0", npm: "10.0.0", date: "2024-12-01" },
	{ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" },
	{ version: "22.10.0", npm: "10.8.0", date: "2024-10-01" },
	{ version: "20.18.1", npm: "10.0.0", date: "2024-10-01" },
	{ version: "20.18.0", npm: "10.0.0", date: "2024-09-15" },
	{ version: "18.20.0", npm: "10.0.0", date: "2024-03-01" },
];

const SemVerLayer = SemVerVersionCacheLive.pipe(Layer.provide(SemVerParserLive));
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));
const CacheLayer = BaseCacheLayer.pipe(
	Layer.tap((ctx) =>
		Effect.gen(function* () {
			const cache = yield* NodeReleaseCache;
			yield* cache.updateSchedule(scheduleData);
			yield* cache.loadFromInputs(nodeInputs);
		}).pipe(Effect.provide(ctx)),
	),
);
const TestLayer = NodeResolverLive.pipe(Layer.provide(CacheLayer));

const testDate = new Date("2025-03-01");

describe("NodeResolver service", () => {
	it("resolve returns current + active-lts versions by default", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			// At 2025-03-01: v23 is current, v22 is active-lts
			return yield* resolver.resolve({ date: testDate });
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.versions).toContain("23.11.0");
		expect(result.versions).toContain("22.11.0");
		expect(result.versions).not.toContain("24.0.0");
		expect(result.latest).toBe("23.11.0");
		expect(result.source).toBe("api");
	});

	it("resolve returns lts field", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				date: testDate,
				phases: ["current", "active-lts", "maintenance-lts"],
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.lts).toBeDefined();
	});

	it("resolve filters by semver range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				semverRange: ">=22.0.0 <23.0.0",
				phases: ["current", "active-lts"],
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.versions.every((v) => v.startsWith("22."))).toBe(true);
	});

	it("resolve includes default version", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				defaultVersion: "20.18.1",
				phases: ["current"],
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.default).toBe("20.18.1");
	});

	it("resolve resolves default from range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				defaultVersion: "^22.0.0",
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		expect(result.default).toBe("22.11.0");
	});

	it("resolve applies increment filtering (latest)", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				phases: ["active-lts", "maintenance-lts"],
				increments: "latest",
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		// Should have one version per major
		const majors = result.versions.map((v) => Number.parseInt(v.split(".")[0], 10));
		expect(new Set(majors).size).toBe(majors.length);
	});

	it("resolve applies increment filtering (minor)", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				phases: ["active-lts", "maintenance-lts"],
				increments: "minor",
				date: testDate,
			});
		});

		const result = await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

		// Should have latest patch per minor
		expect(result.versions).toContain("20.18.1");
		expect(result.versions).not.toContain("20.18.0");
	});

	it("resolve fails with VersionNotFoundError for impossible range", async () => {
		const program = Effect.gen(function* () {
			const resolver = yield* NodeResolver;
			return yield* resolver.resolve({
				semverRange: ">=99.0.0",
				date: testDate,
			});
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(TestLayer)));

		expect(exit._tag).toBe("Failure");
		if (exit._tag === "Failure" && exit.cause._tag === "Fail") {
			expect(exit.cause.error._tag).toBe("VersionNotFoundError");
		}
	});

	it("resolve fails with VersionNotFoundError for invalid semver range", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* NodeResolver;
				return yield* resolver.resolve({ semverRange: "not-a-range!!!" });
			}).pipe(Effect.provide(TestLayer), Effect.flip),
		);
		// Invalid range causes cache.filter to fail → caught → empty list → VersionNotFoundError
		expect(result._tag).toBe("VersionNotFoundError");
	});

	it("sets default to latest LTS when no defaultVersion is provided", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* NodeResolver;
				return yield* resolver.resolve({
					semverRange: ">=18",
					phases: ["current", "active-lts"],
					date: testDate,
				});
			}).pipe(Effect.provide(TestLayer)),
		);
		if (result.lts) {
			expect(result.default).toBe(result.lts);
		}
	});

	it("resolve returns active-lts as lts value", async () => {
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* NodeResolver;
				// At 2025-03-01, v22 is active-lts
				return yield* resolver.resolve({
					phases: ["current", "active-lts"],
					date: testDate,
				});
			}).pipe(Effect.provide(TestLayer)),
		);
		expect(result.lts).toBeDefined();
		expect(result.lts).toBe("22.11.0");
	});

	it("resolve uses provided date for phase filtering", async () => {
		// At 2025-06-01: v24 is current (started 2025-04-22, lts not until 2025-10-28)
		// v23 ended 2025-06-01 so it's end-of-life at this exact date
		const futureDate = new Date("2025-07-01");
		const result = await Effect.runPromise(
			Effect.gen(function* () {
				const resolver = yield* NodeResolver;
				return yield* resolver.resolve({
					phases: ["current"],
					date: futureDate,
				});
			}).pipe(Effect.provide(TestLayer)),
		);
		expect(result.versions).toContain("24.0.0");
		expect(result.versions).not.toContain("23.11.0");
	});
});
