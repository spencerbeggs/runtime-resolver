import { describe, expect, it } from "@effect/vitest";
import { GitHubClient } from "@effected/runtimes";
import { Layer, Option, Redacted } from "effect";
import { githubClientFor, liveResolverLayers, offlineResolverLayers, selectResolverLayers } from "../layers.js";

describe("githubClientFor", () => {
	it("selects the batteries-included default layer when no token is given", () => {
		// Reference identity matters: the default layer is a module constant so the
		// runtime memoizes it to a single build.
		expect(githubClientFor(Option.none())).toBe(GitHubClient.layerDefault);
	});

	it("selects a distinct token-authenticated layer when a PAT is given", () => {
		const layer = githubClientFor(Option.some(Redacted.make("ghp_example")));
		expect(layer).not.toBe(GitHubClient.layerDefault);
	});
});

describe("liveResolverLayers", () => {
	it("exposes a Node layer and token-parameterized Bun/Deno layer factories", () => {
		expect(Layer.isLayer(liveResolverLayers.node)).toBe(true);
		expect(Layer.isLayer(liveResolverLayers.bun(Option.none()))).toBe(true);
		expect(Layer.isLayer(liveResolverLayers.deno(Option.some(Redacted.make("ghp_example"))))).toBe(true);
	});
});

describe("selectResolverLayers", () => {
	it("returns the live layers by default and the snapshot layers when offline", () => {
		expect(selectResolverLayers(false)).toBe(liveResolverLayers);
		expect(selectResolverLayers(true)).toBe(offlineResolverLayers);
	});

	it("exposes snapshot layers that need no token", () => {
		expect(Layer.isLayer(offlineResolverLayers.node)).toBe(true);
		expect(Layer.isLayer(offlineResolverLayers.bun(Option.none()))).toBe(true);
		expect(Layer.isLayer(offlineResolverLayers.deno(Option.none()))).toBe(true);
	});
});
