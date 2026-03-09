/* v8 ignore start */
import { Options } from "@effect/cli";
import { Console, Effect, Layer, Option } from "effect";
import { BunResolverLive } from "../../layers/BunResolverLive.js";
import { DenoResolverLive } from "../../layers/DenoResolverLive.js";
import { GitHubClientLive } from "../../layers/GitHubClientLive.js";
import { GitHubTokenAuth } from "../../layers/GitHubTokenAuth.js";
import { NodeResolverLive } from "../../layers/NodeResolverLive.js";
import { VersionCacheLive } from "../../layers/VersionCacheLive.js";
import type { Increments, NodePhase } from "../../schemas/common.js";
import { BunResolver } from "../../services/BunResolver.js";
import { DenoResolver } from "../../services/DenoResolver.js";
import { NodeResolver } from "../../services/NodeResolver.js";
import type { CliResponse, CliRuntimeResult } from "../schemas/response.js";

// --- Options ---

export const nodeOption = Options.text("node").pipe(Options.optional);
export const bunOption = Options.text("bun").pipe(Options.optional);
export const denoOption = Options.text("deno").pipe(Options.optional);
export const nodePhasesOption = Options.text("node-phases").pipe(Options.optional);
export const nodeIncrementsOption = Options.text("node-increments").pipe(Options.optional);
export const prettyOption = Options.boolean("pretty").pipe(Options.withDefault(false));
export const schemaOption = Options.boolean("schema").pipe(Options.withDefault(false));

// --- Layers ---

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth));
const SharedLayer = Layer.merge(GitHubLayer, VersionCacheLive);

const NodeLayer = NodeResolverLive.pipe(Layer.provide(SharedLayer));
const BunLayer = BunResolverLive.pipe(Layer.provide(SharedLayer));
const DenoLayer = DenoResolverLive.pipe(Layer.provide(SharedLayer));

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

const resolveNode = (
	semverRange: string,
	phases: Option.Option<string>,
	increments: Option.Option<string>,
): Effect.Effect<CliRuntimeResult> =>
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
		return {
			ok: true as const,
			versions: result.versions as string[],
			latest: result.latest,
			...(result.lts ? { lts: result.lts } : {}),
			...(result.default ? { default: result.default } : {}),
		};
	}).pipe(
		Effect.provide(NodeLayer),
		Effect.catchAll((error) =>
			Effect.succeed({
				ok: false as const,
				error: serializeError(error),
			}),
		),
	);

const resolveBun = (semverRange: string): Effect.Effect<CliRuntimeResult> =>
	Effect.gen(function* () {
		const resolver = yield* BunResolver;
		const result = yield* resolver.resolve({ semverRange });
		return {
			ok: true as const,
			versions: result.versions as string[],
			latest: result.latest,
			...(result.lts ? { lts: result.lts } : {}),
			...(result.default ? { default: result.default } : {}),
		};
	}).pipe(
		Effect.provide(BunLayer),
		Effect.catchAll((error) =>
			Effect.succeed({
				ok: false as const,
				error: serializeError(error),
			}),
		),
	);

const resolveDeno = (semverRange: string): Effect.Effect<CliRuntimeResult> =>
	Effect.gen(function* () {
		const resolver = yield* DenoResolver;
		const result = yield* resolver.resolve({ semverRange });
		return {
			ok: true as const,
			versions: result.versions as string[],
			latest: result.latest,
			...(result.lts ? { lts: result.lts } : {}),
			...(result.default ? { default: result.default } : {}),
		};
	}).pipe(
		Effect.provide(DenoLayer),
		Effect.catchAll((error) =>
			Effect.succeed({
				ok: false as const,
				error: serializeError(error),
			}),
		),
	);

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

		if (!hasNode && !hasBun && !hasDeno) {
			yield* Console.error("Error: At least one runtime flag is required (--node, --bun, --deno)");
			return yield* Effect.fail("No runtime specified" as const);
		}

		// Resolve each requested runtime independently
		const results: Record<string, CliRuntimeResult> = {};

		const tasks: Effect.Effect<void>[] = [];

		if (hasNode) {
			tasks.push(
				resolveNode(args.node.value, args.nodePhases, args.nodeIncrements).pipe(
					Effect.tap((result) =>
						Effect.sync(() => {
							results.node = result;
						}),
					),
				),
			);
		}

		if (hasBun) {
			tasks.push(
				resolveBun(args.bun.value).pipe(
					Effect.tap((result) =>
						Effect.sync(() => {
							results.bun = result;
						}),
					),
				),
			);
		}

		if (hasDeno) {
			tasks.push(
				resolveDeno(args.deno.value).pipe(
					Effect.tap((result) =>
						Effect.sync(() => {
							results.deno = result;
						}),
					),
				),
			);
		}

		yield* Effect.all(tasks, { concurrency: "unbounded" });

		const hasError = Object.values(results).some((r) => !r.ok);
		const response: CliResponse = {
			ok: !hasError as CliResponse["ok"],
			results,
		};

		const indent = args.pretty ? 2 : undefined;
		yield* Console.log(JSON.stringify(response, null, indent));
	});
