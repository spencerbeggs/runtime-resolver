import { Effect, Equal } from "effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "./bun-release.js";

describe("BunRelease", () => {
	it("creates from valid input", () => {
		const release = Effect.runSync(BunRelease.fromInput({ version: "1.2.3", date: "2025-01-15" }));
		expect(release._tag).toBe("BunRelease");
		expect(release.version.major).toBe(1);
		expect(release.version.minor).toBe(2);
		expect(release.version.patch).toBe(3);
	});

	it("fails on invalid version", () => {
		const result = Effect.runSyncExit(BunRelease.fromInput({ version: "bad", date: "2025-01-15" }));
		expect(result._tag).toBe("Failure");
	});

	it("has structural equality via Data.TaggedClass", () => {
		const a = Effect.runSync(BunRelease.fromInput({ version: "1.0.0", date: "2025-01-01" }));
		const b = Effect.runSync(BunRelease.fromInput({ version: "1.0.0", date: "2025-01-01" }));
		expect(Equal.equals(a, b)).toBe(true);
	});
});
