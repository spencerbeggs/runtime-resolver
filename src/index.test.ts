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
	it("exports services from effect entry point", async () => {
		const mod = await import("./effect.js");
		expect(mod.BunResolver).toBeDefined();
		expect(mod.DenoResolver).toBeDefined();
		expect(mod.NodeResolver).toBeDefined();
		expect(mod.GitHubClient).toBeDefined();
		expect(mod.VersionCache).toBeDefined();
	});

	it("exports layers from effect entry point", async () => {
		const mod = await import("./effect.js");
		expect(mod.BunResolverLive).toBeDefined();
		expect(mod.DenoResolverLive).toBeDefined();
		expect(mod.NodeResolverLive).toBeDefined();
		expect(mod.GitHubClientLive).toBeDefined();
		expect(mod.GitHubTokenAuth).toBeDefined();
		expect(mod.GitHubAppAuth).toBeDefined();
		expect(mod.VersionCacheLive).toBeDefined();
	});

	it("exports errors from effect entry point", async () => {
		const mod = await import("./effect.js");
		expect(mod.CacheError).toBeDefined();
		expect(mod.NetworkError).toBeDefined();
		expect(mod.ParseError).toBeDefined();
		expect(mod.RateLimitError).toBeDefined();
		expect(mod.VersionNotFoundError).toBeDefined();
		expect(mod.InvalidInputError).toBeDefined();
	});
});
