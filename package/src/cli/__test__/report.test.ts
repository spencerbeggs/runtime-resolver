import { describe, expect, it } from "@effect/vitest";
import { Cause } from "effect";
import { CliError } from "effect/unstable/cli";
import { failureMessage } from "../report.js";

describe("failureMessage", () => {
	it("formats a UserError as a single error line", () => {
		const cause = Cause.fail(new CliError.UserError({ cause: "no runtime requested" }));
		expect(failureMessage(cause)).toBe("error: no runtime requested");
	});

	it("returns null for a ShowHelp failure the framework already rendered", () => {
		const cause = Cause.fail(new CliError.ShowHelp({ commandPath: ["runtime-resolver"], errors: [] }));
		expect(failureMessage(cause)).toBeNull();
	});

	it("formats any other CliError through its string form", () => {
		const cause = Cause.fail(new CliError.MissingOption({ option: "--node" }));
		expect(failureMessage(cause)).toMatch(/^error: /);
	});

	it("surfaces a defect through the full cause", () => {
		const message = failureMessage(Cause.die(new Error("boom")));
		expect(message).toContain("boom");
	});
});
