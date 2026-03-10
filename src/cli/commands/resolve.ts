/* v8 ignore start */
import { Options } from "@effect/cli";
import { Console, Effect, Option } from "effect";
import { BunLayer, DenoLayer, NodeLayer } from "../../layers/index.js";
import type { Freshness, Increments, NodePhase } from "../../schemas/common.js";
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
export const incrementsOption = Options.text("increments").pipe(Options.optional);
export const nodeDefaultOption = Options.text("node-default").pipe(Options.optional);
export const bunDefaultOption = Options.text("bun-default").pipe(Options.optional);
export const denoDefaultOption = Options.text("deno-default").pipe(Options.optional);
export const freshnessOption = Options.text("freshness").pipe(Options.optional);
export const nodeDateOption = Options.text("node-date").pipe(Options.optional);
export const prettyOption = Options.boolean("pretty").pipe(Options.withDefault(false));
export const schemaOption = Options.boolean("schema").pipe(Options.withDefault(false));

// --- Validation helpers ---

const VALID_PHASES = ["current", "active-lts", "maintenance-lts", "end-of-life"] as const;
const VALID_INCREMENTS = ["latest", "minor", "patch"] as const;
const VALID_FRESHNESS = ["auto", "api", "cache"] as const;

const validatePhases = (raw: string): NodePhase[] => {
	const phases = raw.split(",").map((s) => s.trim());
	for (const p of phases) {
		if (!(VALID_PHASES as readonly string[]).includes(p)) {
			throw new Error(`Invalid phase: "${p}". Valid values: ${VALID_PHASES.join(", ")}`);
		}
	}
	return phases as NodePhase[];
};

const validateIncrements = (raw: string): Increments => {
	if (!(VALID_INCREMENTS as readonly string[]).includes(raw)) {
		throw new Error(`Invalid increments value: "${raw}". Valid values: ${VALID_INCREMENTS.join(", ")}`);
	}
	return raw as Increments;
};

const validateFreshness = (raw: string): Freshness => {
	if (!(VALID_FRESHNESS as readonly string[]).includes(raw)) {
		throw new Error(`Invalid freshness value: "${raw}". Valid values: ${VALID_FRESHNESS.join(", ")}`);
	}
	return raw as Freshness;
};

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
	result: {
		source: string;
		versions: readonly string[];
		latest: string;
		lts?: string | undefined;
		default?: string | undefined;
	},
): RuntimeEntry => [
	name,
	{
		ok: true as const,
		source: result.source,
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
	phases?: NodePhase[],
	increments?: Increments,
	defaultVersion?: string,
	date?: Date,
	freshness?: Freshness,
): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* NodeResolver;
		const result = yield* resolver.resolve({
			semverRange,
			...(phases ? { phases } : {}),
			...(increments ? { increments } : {}),
			...(defaultVersion ? { defaultVersion } : {}),
			...(date ? { date } : {}),
			...(freshness ? { freshness } : {}),
		});
		return toSuccess("node", result);
	}).pipe(
		Effect.provide(NodeLayer),
		Effect.catchAll((error) => Effect.succeed(toError("node", error))),
	);

const resolveBun = (
	semverRange: string,
	increments?: Increments,
	defaultVersion?: string,
	freshness?: Freshness,
): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* BunResolver;
		const result = yield* resolver.resolve({
			semverRange,
			...(increments ? { increments } : {}),
			...(defaultVersion ? { defaultVersion } : {}),
			...(freshness ? { freshness } : {}),
		});
		return toSuccess("bun", result);
	}).pipe(
		Effect.provide(BunLayer),
		Effect.catchAll((error) => Effect.succeed(toError("bun", error))),
	);

const resolveDeno = (
	semverRange: string,
	increments?: Increments,
	defaultVersion?: string,
	freshness?: Freshness,
): Effect.Effect<RuntimeEntry> =>
	Effect.gen(function* () {
		const resolver = yield* DenoResolver;
		const result = yield* resolver.resolve({
			semverRange,
			...(increments ? { increments } : {}),
			...(defaultVersion ? { defaultVersion } : {}),
			...(freshness ? { freshness } : {}),
		});
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
	readonly increments: Option.Option<string>;
	readonly freshness: Option.Option<string>;
	readonly nodeDefault: Option.Option<string>;
	readonly bunDefault: Option.Option<string>;
	readonly denoDefault: Option.Option<string>;
	readonly nodeDate: Option.Option<string>;
	readonly pretty: boolean;
	readonly schema: boolean;
}) =>
	Effect.gen(function* () {
		// Handle --schema flag with strict validation
		if (args.schema) {
			const resolveFlags = [
				args.node,
				args.bun,
				args.deno,
				args.nodePhases,
				args.increments,
				args.freshness,
				args.nodeDefault,
				args.bunDefault,
				args.denoDefault,
				args.nodeDate,
			];
			const hasResolveFlags = resolveFlags.some((f) => Option.isSome(f));
			if (hasResolveFlags) {
				yield* Console.error("Error: --schema cannot be combined with resolve flags (--node, --bun, --deno, etc.)");
				return;
			}

			const { cliJsonSchema } = yield* Effect.promise(() => import("../schemas/json-schema.js"));
			yield* Console.log(JSON.stringify(cliJsonSchema, null, 2));
			return;
		}

		const hasNode = Option.isSome(args.node);
		const hasBun = Option.isSome(args.bun);
		const hasDeno = Option.isSome(args.deno);

		if (!hasNode && !hasBun && !hasDeno) {
			yield* Console.error(
				"No runtime specified. Use --node, --bun, or --deno to resolve versions.\nRun with --help for usage information.",
			);
			return;
		}

		// Validate and extract phases
		let validatedPhases: NodePhase[] | undefined;
		if (Option.isSome(args.nodePhases)) {
			try {
				validatedPhases = validatePhases(args.nodePhases.value);
			} catch (e) {
				yield* Console.error((e as Error).message);
				return;
			}
		}

		// Validate and extract increments
		let validatedIncrements: Increments | undefined;
		if (Option.isSome(args.increments)) {
			validatedIncrements = validateIncrements(args.increments.value);
		}

		// Validate and extract freshness
		let validatedFreshness: Freshness | undefined;
		if (Option.isSome(args.freshness)) {
			try {
				validatedFreshness = validateFreshness(args.freshness.value);
			} catch (e) {
				yield* Console.error((e as Error).message);
				return;
			}
		}

		// Parse node date
		let nodeDate: Date | undefined;
		if (Option.isSome(args.nodeDate)) {
			nodeDate = new Date(args.nodeDate.value);
			if (Number.isNaN(nodeDate.getTime())) {
				yield* Console.error(`Invalid date: "${args.nodeDate.value}". Use ISO 8601 format (e.g. 2024-01-15).`);
				return;
			}
		}

		// Resolve each requested runtime independently
		const tasks: Effect.Effect<RuntimeEntry>[] = [];

		if (hasNode) {
			const nodeDefaultVersion = Option.isSome(args.nodeDefault) ? args.nodeDefault.value : undefined;
			tasks.push(
				resolveNode(
					args.node.value,
					validatedPhases,
					validatedIncrements,
					nodeDefaultVersion,
					nodeDate,
					validatedFreshness,
				),
			);
		}
		if (hasBun) {
			const bunDefaultVersion = Option.isSome(args.bunDefault) ? args.bunDefault.value : undefined;
			tasks.push(resolveBun(args.bun.value, validatedIncrements, bunDefaultVersion, validatedFreshness));
		}
		if (hasDeno) {
			const denoDefaultVersion = Option.isSome(args.denoDefault) ? args.denoDefault.value : undefined;
			tasks.push(resolveDeno(args.deno.value, validatedIncrements, denoDefaultVersion, validatedFreshness));
		}

		const entries = yield* Effect.all(tasks, { concurrency: "unbounded" });
		const results: Record<string, CliRuntimeResult> = Object.fromEntries(entries);
		const hasError = Object.values(results).some((r) => !r.ok);

		yield* Console.log(formatResponse(!hasError as CliResponse["ok"], results, args.pretty));
	});
