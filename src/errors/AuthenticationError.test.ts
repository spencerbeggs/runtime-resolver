import { describe, expect, it } from "vitest";
import { AuthenticationError } from "./AuthenticationError.js";

describe("AuthenticationError", () => {
	it("creates a token authentication error", () => {
		const error = new AuthenticationError({
			method: "token",
			message: "Bad credentials",
		});
		expect(error._tag).toBe("AuthenticationError");
		expect(error.method).toBe("token");
		expect(error.message).toBe("Bad credentials");
	});

	it("creates an app authentication error", () => {
		const error = new AuthenticationError({
			method: "app",
			message: "Invalid private key",
		});
		expect(error._tag).toBe("AuthenticationError");
		expect(error.method).toBe("app");
		expect(error.message).toBe("Invalid private key");
	});
});
