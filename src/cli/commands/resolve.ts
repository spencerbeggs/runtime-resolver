/* v8 ignore start */
import { Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { BunLayer, DenoLayer, NodeLayer } from "../../layers/index.js";
import type { Increments, NodePhase } from "../../schemas/common.js";
import { BunResolver } from "../../services/BunResolver.js";
import { DenoResolver } from "../../services/DenoResolver.js";
import { NodeResolver } from "../../services/NodeResolver.js";
import type { CliResponse, CliRuntimeResult } from "../schemas/response.js";

const SCHEMA_URL = "https://raw.githubusercontent.com/spencerbeggs/runtime-resolver/main/runtime-resolver.schema.json";

// --- Options ---

export const nodeOption = Options.text("node").pipe(Options.optional);
export const bunOption = Options.text("bun").pipe(Options.optional);
export const denoOption = Options.text("deno").pipe(Options.optional);
export const nodePhasesOption = Options.text("node-phases").pipe(Options.optional);
export const nodeIncrementsOption = Options.text("node-increments").pipe(Options.optional);
export const prettyOption = Options.boolean("pretty").pipe(Options.withDefault(false));
export const schemaOption = Options.boolean("schema").pipe(Options.withDefault(false));

// --- Error serialization ---

const serializeError = (error: unknown): { _tag: string; message: string; [key: string]: unknown } => {
	if (error && typeof error === "object" && "_tag" in error && "message" in error) {
		const { _tag, message, ...rest } = error as { _tag: string; message: string; [key: string]: unknown };
		return { _tag, message, ...rest };
	}
	return {
		_tag: "UnknownError",
		message: error instanceof Error ? error.message : String(error),
	};
};

// --- Runtime resolution helpers ---

type RuntimeEntry = readonly [string, CliRuntimeResult];

const toSuccess = (
	name: string,
	result: { versions: readonly string[]; latest: string; lts?: string | undefined; default?: string | undefined },
): RuntimeEntry => [
	name,
	{
		ok: true as const,
		versions: [...result.versions],
		latest: result.latest,
		...(result.lts !== undefined ? { lts: result.lts } : {}),
		...(result.default !== undefined ? { default: result.default } : {}),
	},
];

const toError = (name: string, error: unknown): RuntimeEntry => [
	name,
	{ ok: false as const, error: serializeError(error) },
];

const resolveNode = (
	semverRange: string,
	phases: Option.Option<string>,
	increments: Option.Option<string>,
): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* NodeResolver;
		const nodePhases = Option.isSome(phases)
			? (phases.value.split(",").map((s) => s.trim()) as NodePhase[])
			: undefined;
		const nodeIncrements = Option.isSome(increments) ? (increments.value as Increments) : undefined;
		const result = yield* resolver.resolve({
			semverRange,
			...(nodePhases ? { phases: nodePhases } : {}),
			...(nodeIncrements ? { increments: nodeIncrements } : {}),
		});
		return toSuccess("node", result);
	}).pipe(
		Effect.provide(NodeLayer),
		Effect.catchAll((error) => Effect.succeed(toError("node", error))),
	);

const resolveBun = (semverRange: string): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* BunResolver;
		const result = yield* resolver.resolve({ semverRange });
		return toSuccess("bun", result);
	}).pipe(
		Effect.provide(BunLayer),
		Effect.catchAll((error) => Effect.succeed(toError("bun", error))),
	);

const resolveDeno = (semverRange: string): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* DenoResolver;
		const result = yield* resolver.resolve({ semverRange });
		return toSuccess("deno", result);
	}).pipe(
		Effect.provide(DenoLayer),
		Effect.catchAll((error) => Effect.succeed(toError("deno", error))),
	);

// --- Response serialization ---

const formatResponse = (ok: CliResponse["ok"], results: Record<string, CliRuntimeResult>, pretty: boolean): string => {
	const response = { $schema: SCHEMA_URL, ok, results } satisfies CliResponse & { $schema: string };
	return JSON.stringify(response, null, pretty ? 2 : undefined);
};

// --- Handler ---

export const resolveHandler = (args: {
	readonly node: Option.Option<string>;
	readonly bun: Option.Option<string>;
	readonly deno: Option.Option<string>;
	readonly nodePhases: Option.Option<string>;
	readonly nodeIncrements: Option.Option<string>;
	readonly pretty: boolean;
	readonly schema: boolean;
}) =>
	Effect.gen(function* () {
		// Handle --schema flag
		if (args.schema) {
			const { cliJsonSchema } = yield* Effect.promise(() => import("../schemas/json-schema.js"));
			yield* Console.log(JSON.stringify(cliJsonSchema, null, 2));
			return;
		}

		const hasNode = Option.isSome(args.node);
		const hasBun = Option.isSome(args.bun);
		const hasDeno = Option.isSome(args.deno);

		// No runtime specified — output JSON error envelope and exit 0
		if (!hasNode && !hasBun && !hasDeno) {
			yield* Console.error(formatResponse(false, {}, args.pretty));
			return;
		}

		// Resolve each requested runtime independently
		const tasks: Effect.Effect<RuntimeEntry>[] = [];

		if (hasNode) {
			tasks.push(resolveNode(args.node.value, args.nodePhases, args.nodeIncrements));
		}
		if (hasBun) {
			tasks.push(resolveBun(args.bun.value));
		}
		if (hasDeno) {
			tasks.push(resolveDeno(args.deno.value));
		}

		const entries = yield* Effect.all(tasks, { concurrency: "unbounded" });
		const results: Record<string, CliRuntimeResult> = Object.fromEntries(entries);
		const hasError = Object.values(results).some((r) => !r.ok);

		yield* Console.log(formatResponse(!hasError as CliResponse["ok"], results, args.pretty));
	});
