import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

describe("GitHubAppAuth", () => {
	it("produces AuthenticationError on invalid credentials", async () => {
		const layer = GitHubAppAuth({
			appId: "invalid",
			privateKey: "not-a-real-key",
		});

		const program = Effect.gen(function* () {
			return yield* OctokitInstance;
		});

		const exit = await Effect.runPromiseExit(program.pipe(Effect.provide(layer)));
		expect(exit._tag).toBe("Failure");

		if (exit._tag === "Failure") {
			const failure = exit.cause as { _tag: string; error: { _tag: string; method: string } };
			expect(failure._tag).toBe("Fail");
			expect(failure.error._tag).toBe("AuthenticationError");
			expect(failure.error.method).toBe("app");
		}
	});
});
