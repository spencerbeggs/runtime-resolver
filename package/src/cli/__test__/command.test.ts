import { describe, expect, it } from "@effect/vitest";
import { BunResolver, DenoResolver, NodeResolver } from "@effected/runtimes";
import { Effect, Layer } from "effect";
import { TestConsole } from "effect/testing";
import { CliError, Command } from "effect/unstable/cli";
import { makeCli } from "../command.js";
import type { ResolverLayers } from "../layers.js";
import { NodeCliEnvironment } from "../layers.js";

/** Deterministic, IO-free resolver layers backed by the kit's bundled snapshot. */
const offlineLayers: ResolverLayers = {
	node: NodeResolver.layerOffline,
	bun: () => BunResolver.layerOffline,
	deno: () => DenoResolver.layerOffline,
};

const cli = makeCli(() => offlineLayers);

/** Run the CLI and return the lines it wrote to stdout via `Console`. */
const runCapture = (args: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<unknown>, CliError.CliError> =>
	Effect.gen(function* () {
		yield* Command.runWith(cli, { version: "test" })(args);
		return yield* TestConsole.logLines;
	}).pipe(Effect.provide(NodeCliEnvironment), Effect.provide(TestConsole.layer));

/** Run the CLI expecting failure, returning the surfaced error. */
const runExpectingError = (args: ReadonlyArray<string>): Effect.Effect<CliError.CliError, void> =>
	Command.runWith(cli, { version: "test" })(args).pipe(
		Effect.provide(NodeCliEnvironment),
		Effect.provide(TestConsole.layer),
		Effect.flip,
	);

// Node resolution filters by lifecycle phase against a date. An explicit
// `--node-date` keeps the result deterministic and sidesteps the epoch clock
// `it.effect` installs. 18.x is end-of-life by this date.
const nodeArgs = ["--node", "^18", "--node-date", "2030-06-01", "--node-phases", "end-of-life"] as const;

describe("cli", () => {
	it.effect("emits a single runtime's ResolvedVersions directly", () =>
		Effect.gen(function* () {
			const lines = yield* runCapture([...nodeArgs]);
			expect(lines).toHaveLength(1);
			const out = JSON.parse(lines[0] as string) as { source: string; versions: Array<string>; latest: string };
			expect(out.source).toBe("cache");
			expect(out.versions.length).toBeGreaterThan(0);
			expect(out.latest).toMatch(/^18\./);
		}),
	);

	it.effect("keys output by runtime name when several are requested", () =>
		Effect.gen(function* () {
			const lines = yield* runCapture([...nodeArgs, "--bun", "^1"]);
			const out = JSON.parse(lines[0] as string) as Record<string, { source: string; latest: string }>;
			expect(Object.keys(out)).toEqual(["node", "bun"]);
			expect(out.node.source).toBe("cache");
			expect(out.bun.latest).toMatch(/^1\./);
		}),
	);

	it.effect("pretty-prints only when --pretty is set", () =>
		Effect.gen(function* () {
			const pretty = yield* runCapture(["--bun", "^1", "--pretty"]);
			expect(pretty[0] as string).toContain("\n");
			const compact = yield* runCapture(["--deno", "^1"]);
			// logLines accumulates across the test, so the second run is the last line.
			expect(compact[compact.length - 1] as string).not.toContain("\n");
		}),
	);

	it.effect("fails with a usage error when no runtime flag is given", () =>
		Effect.gen(function* () {
			const error = yield* runExpectingError([]);
			expect(error).toBeInstanceOf(CliError.UserError);
			expect(String((error as CliError.UserError).cause)).toContain("no runtime requested");
		}),
	);

	it.effect("fails with a usage error on an invalid --node-phases value", () =>
		Effect.gen(function* () {
			const error = yield* runExpectingError(["--node", "^18", "--node-phases", "bogus"]);
			expect(error).toBeInstanceOf(CliError.UserError);
			expect(String((error as CliError.UserError).cause)).toContain("bogus");
		}),
	);

	it.effect("fails with a resolution error when the range matches nothing", () =>
		Effect.gen(function* () {
			const error = yield* runExpectingError(["--node", "^999", "--node-date", "2024-01-01"]);
			expect(error).toBeInstanceOf(CliError.UserError);
			expect(String((error as CliError.UserError).cause)).toContain("no node version matched");
		}),
	);

	it.effect("names the runtime in a Bun resolution error", () =>
		Effect.gen(function* () {
			const error = yield* runExpectingError(["--bun", "^999"]);
			expect(String((error as CliError.UserError).cause)).toContain("no bun version matched");
		}),
	);

	it.effect("names the runtime in a Deno resolution error", () =>
		Effect.gen(function* () {
			const error = yield* runExpectingError(["--deno", "^999"]);
			expect(String((error as CliError.UserError).cause)).toContain("no deno version matched");
		}),
	);

	it.effect("applies --increments to the requested runtimes", () =>
		Effect.gen(function* () {
			const lines = yield* runCapture(["--bun", ">=1", "--increments", "patch"]);
			const out = JSON.parse(lines[0] as string) as { versions: Array<string> };
			expect(out.versions.length).toBeGreaterThan(0);
		}),
	);

	// Regression: an unrequested runtime's layer must never be built. The kit's
	// live `.layer` fetches its feed at acquisition, so building a Bun/Deno layer
	// for a `--node`-only run is wasted IO (and burns the anon rate limit). These
	// tripwire layers die if acquired, so the run fails should the gating regress.
	it.effect("never builds resolver layers for unrequested runtimes", () =>
		Effect.gen(function* () {
			const tripwireCli = makeCli(() => ({
				node: NodeResolver.layerOffline,
				bun: () => Layer.effect(BunResolver)(Effect.die("bun resolver acquired for an unrequested runtime")),
				deno: () => Layer.effect(DenoResolver)(Effect.die("deno resolver acquired for an unrequested runtime")),
			}));
			yield* Command.runWith(tripwireCli, { version: "test" })([...nodeArgs]).pipe(Effect.provide(NodeCliEnvironment));
			const lines = yield* TestConsole.logLines;
			const out = JSON.parse(lines[0] as string) as { source: string };
			expect(out.source).toBe("cache");
		}),
	);

	// `--offline` must pick the snapshot layers. The selector's *live* branch
	// dies on acquisition, so a run reaching it (i.e. `--offline` ignored) fails;
	// the *offline* branch is the real snapshot. Also re-asserts the unrequested-
	// runtime guarantee, since only the requested runtime's layer is built.
	const offlineSelectorCli = makeCli((offline) =>
		offline
			? {
					node: NodeResolver.layerOffline,
					bun: () => BunResolver.layerOffline,
					deno: () => DenoResolver.layerOffline,
				}
			: {
					node: Layer.effect(NodeResolver)(Effect.die("live node layer acquired despite --offline")),
					bun: () => Layer.effect(BunResolver)(Effect.die("live bun layer acquired despite --offline")),
					deno: () => Layer.effect(DenoResolver)(Effect.die("live deno layer acquired despite --offline")),
				},
	);

	it.effect("--offline selects the snapshot layers", () =>
		Effect.gen(function* () {
			yield* Command.runWith(offlineSelectorCli, { version: "test" })([...nodeArgs, "--offline"]).pipe(
				Effect.provide(NodeCliEnvironment),
			);
			const lines = yield* TestConsole.logLines;
			const out = JSON.parse(lines[0] as string) as { source: string };
			expect(out.source).toBe("cache");
		}),
	);

	it.effect("--offline needs no token and makes no network call for Bun/Deno", () =>
		Effect.gen(function* () {
			yield* Command.runWith(offlineSelectorCli, { version: "test" })([
				"--bun",
				">=1",
				"--deno",
				">=1",
				"--offline",
			]).pipe(Effect.provide(NodeCliEnvironment));
			const lines = yield* TestConsole.logLines;
			const out = JSON.parse(lines[0] as string) as Record<string, { source: string }>;
			expect(out.bun.source).toBe("cache");
			expect(out.deno.source).toBe("cache");
		}),
	);

	it.effect("without --offline the live layers are chosen", () =>
		Effect.gen(function* () {
			const exit = yield* Command.runWith(offlineSelectorCli, { version: "test" })([
				"--node",
				">=18",
				"--node-date",
				"2030-06-01",
			]).pipe(Effect.provide(NodeCliEnvironment), Effect.exit);
			// The live node layer dies on acquisition, so choosing it fails the run.
			expect(exit._tag).toBe("Failure");
		}),
	);
});
