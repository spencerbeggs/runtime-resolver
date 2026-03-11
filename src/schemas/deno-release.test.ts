import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DenoRelease } from "./deno-release.js";

describe("DenoRelease", () => {
	it("creates from valid input", () => {
		const release = Effect.runSync(DenoRelease.fromInput({ version: "2.7.3", date: "2025-03-01" }));
		expect(release._tag).toBe("DenoRelease");
		expect(release.version.major).toBe(2);
	});

	it("fails on invalid version", () => {
		const result = Effect.runSyncExit(DenoRelease.fromInput({ version: "xyz", date: "2025-01-01" }));
		expect(result._tag).toBe("Failure");
	});
});
