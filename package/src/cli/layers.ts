import { BunResolver, DenoResolver, GitHubAuth, GitHubClient, NodeResolver } from "@effected/runtimes";
import type { Redacted } from "effect";
import { Effect, FileSystem, Layer, Option, Path, Stdio, Terminal } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { ChildProcessSpawner } from "effect/unstable/process";

/**
 * The `fetch`-backed HTTP client, bound to one constant so every resolver layer
 * shares the same reference and the runtime memoizes it to a single build.
 */
const httpClient = FetchHttpClient.layer;

/**
 * Choose the GitHub credential wiring.
 *
 * With `--token`, authenticate with the supplied PAT over `fetch`. Without one,
 * `GitHubClient.layerDefault` pre-wires environment-detected auth
 * (`GITHUB_PERSONAL_ACCESS_TOKEN` → `GITHUB_TOKEN` → anonymous) over `fetch`.
 */
export const githubClientFor = (token: Option.Option<Redacted.Redacted<string>>): Layer.Layer<GitHubClient> =>
	Option.match(token, {
		onNone: () => GitHubClient.layerDefault,
		onSome: (pat) => GitHubClient.layer.pipe(Layer.provide(Layer.mergeAll(GitHubAuth.token(pat), httpClient))),
	});

/**
 * The resolver layers the CLI provides, one per runtime.
 *
 * Node needs no token; Bun and Deno take the parsed `--token` because their
 * credential wiring depends on it. The layers are provided *inside* each
 * flag-gated branch of the handler, never merged — the kit's live `.layer`
 * fetches its release feed at acquisition, so building a runtime's layer is an
 * IO cost that must be paid only when that runtime was actually requested.
 */
export interface ResolverLayers {
	readonly node: Layer.Layer<NodeResolver>;
	readonly bun: (token: Option.Option<Redacted.Redacted<string>>) => Layer.Layer<BunResolver>;
	readonly deno: (token: Option.Option<Redacted.Redacted<string>>) => Layer.Layer<DenoResolver>;
}

/**
 * The live resolver layers: real feeds over `fetch`, with the kit's snapshot
 * fallback. Each is built only when its runtime's branch runs.
 */
export const liveResolverLayers: ResolverLayers = {
	node: NodeResolver.layer.pipe(Layer.provide(httpClient)),
	bun: (token) => BunResolver.layer.pipe(Layer.provide(githubClientFor(token))),
	deno: (token) => DenoResolver.layer.pipe(Layer.provide(githubClientFor(token))),
};

/**
 * The snapshot-only resolver layers used by `--offline`: the kit's
 * `.layerOffline`, which performs no IO, requires nothing, and needs no token.
 * Every answer is `source: "cache"`.
 */
export const offlineResolverLayers: ResolverLayers = {
	node: NodeResolver.layerOffline,
	bun: () => BunResolver.layerOffline,
	deno: () => DenoResolver.layerOffline,
};

/** Pick the resolver layer set for a run: snapshot-only when `--offline`, else live. */
export const selectResolverLayers = (offline: boolean): ResolverLayers =>
	offline ? offlineResolverLayers : liveResolverLayers;

/** A `Terminal` that dies if any member is touched — this CLI is non-interactive. */
const deadTerminal = Terminal.make({
	columns: Effect.die("terminal is not available in runtime-resolver"),
	rows: Effect.die("terminal is not available in runtime-resolver"),
	readInput: Effect.die("terminal input is not available in runtime-resolver"),
	readLine: Effect.die("terminal input is not available in runtime-resolver"),
	display: () => Effect.die("terminal output is not available in runtime-resolver"),
});

/**
 * The five `Command.Environment` services, implemented for a non-interactive
 * Node bin. `Path` is real; `FileSystem`, `Terminal` and `ChildProcessSpawner`
 * are unused by this CLI and fail loudly if that ever changes; `Stdio` is inert
 * because arguments come from `process.argv` and output goes through `Console`.
 */
export const NodeCliEnvironment = Layer.mergeAll(
	Path.layer,
	FileSystem.layerNoop({}),
	Stdio.layerTest({}),
	Layer.succeed(Terminal.Terminal, deadTerminal),
	Layer.succeed(
		ChildProcessSpawner.ChildProcessSpawner,
		ChildProcessSpawner.make(() => Effect.die("subprocess spawning is not available in runtime-resolver")),
	),
);
