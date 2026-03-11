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
		expect(mod.BunReleaseCache).toBeDefined();
		expect(mod.DenoReleaseCache).toBeDefined();
		expect(mod.NodeReleaseCache).toBeDefined();
		expect(mod.BunVersionFetcher).toBeDefined();
		expect(mod.DenoVersionFetcher).toBeDefined();
		expect(mod.NodeVersionFetcher).toBeDefined();
		expect(mod.NodeScheduleFetcher).toBeDefined();
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
		expect(mod.AutoBunCacheLive).toBeDefined();
		expect(mod.AutoDenoCacheLive).toBeDefined();
		expect(mod.AutoNodeCacheLive).toBeDefined();
		expect(mod.FreshBunCacheLive).toBeDefined();
		expect(mod.FreshDenoCacheLive).toBeDefined();
		expect(mod.FreshNodeCacheLive).toBeDefined();
		expect(mod.OfflineBunCacheLive).toBeDefined();
		expect(mod.OfflineDenoCacheLive).toBeDefined();
		expect(mod.OfflineNodeCacheLive).toBeDefined();
		expect(mod.BunReleaseCacheLive).toBeDefined();
		expect(mod.DenoReleaseCacheLive).toBeDefined();
		expect(mod.NodeReleaseCacheLive).toBeDefined();
		expect(mod.createRuntimeCache).toBeDefined();
		expect(mod.BunVersionFetcherLive).toBeDefined();
		expect(mod.DenoVersionFetcherLive).toBeDefined();
		expect(mod.NodeVersionFetcherLive).toBeDefined();
		expect(mod.NodeScheduleFetcherLive).toBeDefined();
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

	it("exports domain classes", async () => {
		const mod = await import("./index.js");
		expect(mod.BunRelease).toBeDefined();
		expect(mod.DenoRelease).toBeDefined();
		expect(mod.NodeRelease).toBeDefined();
		expect(mod.NodeSchedule).toBeDefined();
	});
});
