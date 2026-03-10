import { describe, expect, it } from "vitest";
import { resolveBun, resolveDeno, resolveNode } from "./index.js";

describe("Promise API exports", () => {
	it("exports resolveNode function", () => {
		expect(typeof resolveNode).toBe("function");
	});

	it("exports resolveBun function", () => {
		expect(typeof resolveBun).toBe("function");
	});

	it("exports resolveDeno function", () => {
		expect(typeof resolveDeno).toBe("function");
	});
});

describe("Effect API exports", () => {
	it("exports services", async () => {
		const mod = await import("./index.js");
		expect(mod.BunResolver).toBeDefined();
		expect(mod.DenoResolver).toBeDefined();
		expect(mod.NodeResolver).toBeDefined();
		expect(mod.GitHubClient).toBeDefined();
		expect(mod.VersionCache).toBeDefined();
	});

	it("exports layers", async () => {
		const mod = await import("./index.js");
		expect(mod.BunResolverLive).toBeDefined();
		expect(mod.DenoResolverLive).toBeDefined();
		expect(mod.NodeResolverLive).toBeDefined();
		expect(mod.GitHubClientLive).toBeDefined();
		expect(mod.GitHubTokenAuth).toBeDefined();
		expect(mod.GitHubAppAuth).toBeDefined();
		expect(mod.GitHubAutoAuth).toBeDefined();
		expect(mod.GitHubTokenAuthFromToken).toBeDefined();
		expect(mod.VersionCacheLive).toBeDefined();
	});

	it("exports errors", async () => {
		const mod = await import("./index.js");
		expect(mod.AuthenticationError).toBeDefined();
		expect(mod.CacheError).toBeDefined();
		expect(mod.NetworkError).toBeDefined();
		expect(mod.ParseError).toBeDefined();
		expect(mod.RateLimitError).toBeDefined();
		expect(mod.VersionNotFoundError).toBeDefined();
		expect(mod.InvalidInputError).toBeDefined();
		expect(mod.FreshnessError).toBeDefined();
	});
});
