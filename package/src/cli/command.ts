import type { NoMatchingVersionError, ResolvedVersions, Runtime, UnresolvableDefaultError } from "@effected/runtimes";
import { BunResolver, DenoResolver, NodeResolver } from "@effected/runtimes";
import type { InvalidRangeError } from "@effected/semver";
import { Console, DateTime, Effect, Option, Result } from "effect";
import { CliError, Command, Flag } from "effect/unstable/cli";
import type { ResolverLayers } from "./layers.js";
import { selectResolverLayers } from "./layers.js";
import { NODE_PHASES, formatOutput, parsePhases } from "./output.js";

/**
 * Turn a resolver's typed failure into the one-line, operator-facing message
 * the process prints to stderr before exiting non-zero.
 */
const describeResolveError = (
	runtime: Runtime,
	error: InvalidRangeError | NoMatchingVersionError | UnresolvableDefaultError,
): string => {
	switch (error._tag) {
		case "InvalidRangeError":
			return `invalid ${runtime} range: ${error.message}`;
		case "NoMatchingVersionError": {
			const scope = error.phases !== undefined ? ` within phase(s) ${error.phases.join(", ")}` : "";
			return `no ${runtime} version matched "${error.constraint}"${scope}`;
		}
		case "UnresolvableDefaultError":
			return `no ${runtime} version matched the requested default "${error.defaultVersion}"`;
	}
};

/** Fail with the CLI framework's user-error, carrying an already-formatted message. */
const usageError = (message: string): Effect.Effect<never, CliError.UserError> =>
	Effect.fail(new CliError.UserError({ cause: message }));

const nodeFlag = Flag.optional(
	Flag.string("node").pipe(Flag.withDescription("Resolve Node.js versions for this semver range")),
);
const bunFlag = Flag.optional(
	Flag.string("bun").pipe(Flag.withDescription("Resolve Bun versions for this semver range")),
);
const denoFlag = Flag.optional(
	Flag.string("deno").pipe(Flag.withDescription("Resolve Deno versions for this semver range")),
);
const nodePhasesFlag = Flag.optional(
	Flag.string("node-phases").pipe(
		Flag.withDescription(`Comma-separated Node lifecycle phases (${NODE_PHASES.join(", ")})`),
	),
);
const incrementsFlag = Flag.optional(
	Flag.choice("increments", ["latest", "minor", "patch"]).pipe(
		Flag.withDescription("Grouping granularity applied to every requested runtime"),
	),
);
const nodeDefaultFlag = Flag.optional(
	Flag.string("node-default").pipe(Flag.withDescription("Range whose newest Node match becomes the `default` field")),
);
const bunDefaultFlag = Flag.optional(
	Flag.string("bun-default").pipe(Flag.withDescription("Range whose newest Bun match becomes the `default` field")),
);
const denoDefaultFlag = Flag.optional(
	Flag.string("deno-default").pipe(Flag.withDescription("Range whose newest Deno match becomes the `default` field")),
);
const nodeDateFlag = Flag.optional(
	Flag.date("node-date").pipe(Flag.withDescription("ISO date at which to evaluate Node lifecycle phases")),
);
const prettyFlag = Flag.boolean("pretty").pipe(
	Flag.withDescription("Pretty-print the JSON output with 2-space indentation"),
);
const offlineFlag = Flag.boolean("offline").pipe(
	Flag.withDescription("Resolve from the bundled snapshot only; make no network requests"),
);
const tokenFlag = Flag.optional(
	Flag.redacted("token").pipe(Flag.withDescription("GitHub personal access token used for Bun and Deno lookups")),
);

/**
 * Build the `runtime-resolver` command around a resolver-layer selector.
 *
 * The selector is called once per run with the parsed `--offline` flag to pick
 * the layer set (live feeds, or the snapshot-only `.layerOffline`). Each
 * runtime's chosen layer is provided *inside* its flag-gated branch and nowhere
 * else, so an unrequested runtime's layer is never built — and, because the
 * kit's live `.layer` fetches its feed at acquisition, never touches the
 * network. Parameterizing the selector is also what lets tests inject
 * `.layerOffline` (or a tripwire that dies if built).
 */
export const makeCli = (selectLayers: (offline: boolean) => ResolverLayers) =>
	Command.make(
		"runtime-resolver",
		{
			node: nodeFlag,
			bun: bunFlag,
			deno: denoFlag,
			nodePhases: nodePhasesFlag,
			increments: incrementsFlag,
			nodeDefault: nodeDefaultFlag,
			bunDefault: bunDefaultFlag,
			denoDefault: denoDefaultFlag,
			nodeDate: nodeDateFlag,
			pretty: prettyFlag,
			offline: offlineFlag,
			token: tokenFlag,
		},
		(config) =>
			Effect.gen(function* () {
				if (Option.isNone(config.node) && Option.isNone(config.bun) && Option.isNone(config.deno)) {
					return yield* usageError("no runtime requested; pass at least one of --node, --bun, --deno");
				}

				const layers = selectLayers(config.offline);

				let phases: ReadonlyArray<(typeof NODE_PHASES)[number]> | undefined;
				if (Option.isSome(config.nodePhases)) {
					const parsed = parsePhases(config.nodePhases.value);
					if (Result.isFailure(parsed)) {
						return yield* usageError(parsed.failure);
					}
					phases = parsed.success;
				}

				const increments = Option.getOrUndefined(config.increments);
				const nodeDate = Option.isSome(config.nodeDate) ? DateTime.fromDateUnsafe(config.nodeDate.value) : undefined;

				const entries: Array<readonly [Runtime, ResolvedVersions]> = [];

				if (Option.isSome(config.node)) {
					const range = config.node.value;
					const defaultVersion = Option.getOrUndefined(config.nodeDefault);
					const resolved = yield* Effect.gen(function* () {
						const resolver = yield* NodeResolver;
						return yield* resolver.resolve({
							range,
							...(phases !== undefined ? { phases } : {}),
							...(increments !== undefined ? { increments } : {}),
							...(defaultVersion !== undefined ? { defaultVersion } : {}),
							...(nodeDate !== undefined ? { date: nodeDate } : {}),
						});
					}).pipe(
						Effect.mapError((error) => new CliError.UserError({ cause: describeResolveError("node", error) })),
						Effect.provide(layers.node),
					);
					entries.push(["node", resolved]);
				}

				if (Option.isSome(config.bun)) {
					const range = config.bun.value;
					const defaultVersion = Option.getOrUndefined(config.bunDefault);
					const resolved = yield* Effect.gen(function* () {
						const resolver = yield* BunResolver;
						return yield* resolver.resolve({
							range,
							...(increments !== undefined ? { increments } : {}),
							...(defaultVersion !== undefined ? { defaultVersion } : {}),
						});
					}).pipe(
						Effect.mapError((error) => new CliError.UserError({ cause: describeResolveError("bun", error) })),
						Effect.provide(layers.bun(config.token)),
					);
					entries.push(["bun", resolved]);
				}

				if (Option.isSome(config.deno)) {
					const range = config.deno.value;
					const defaultVersion = Option.getOrUndefined(config.denoDefault);
					const resolved = yield* Effect.gen(function* () {
						const resolver = yield* DenoResolver;
						return yield* resolver.resolve({
							range,
							...(increments !== undefined ? { increments } : {}),
							...(defaultVersion !== undefined ? { defaultVersion } : {}),
						});
					}).pipe(
						Effect.mapError((error) => new CliError.UserError({ cause: describeResolveError("deno", error) })),
						Effect.provide(layers.deno(config.token)),
					);
					entries.push(["deno", resolved]);
				}

				yield* Console.log(formatOutput(entries, config.pretty));
			}),
	);

/** The production command: `--offline` selects snapshot-only layers, else live. */
export const cli = makeCli(selectResolverLayers);
