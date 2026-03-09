#!/usr/bin/env node
/* v8 ignore start - CLI entry point requires integration testing */
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

import {
	bunOption,
	denoOption,
	nodeIncrementsOption,
	nodeOption,
	nodePhasesOption,
	prettyOption,
	resolveHandler,
	schemaOption,
} from "./commands/resolve.js";

const rootCommand = Command.make(
	"runtime-resolver",
	{
		node: nodeOption,
		bun: bunOption,
		deno: denoOption,
		nodePhases: nodePhasesOption,
		nodeIncrements: nodeIncrementsOption,
		pretty: prettyOption,
		schema: schemaOption,
	},
	resolveHandler,
);

const cli = Command.run(rootCommand, {
	name: "runtime-resolver",
	version: process.env.__PACKAGE_VERSION__,
});

const main = Effect.suspend(() => cli(process.argv)).pipe(
	Effect.provide(NodeContext.layer),
	Effect.catchAllCause((cause) => {
		const defects = Cause.defects(cause);
		if (defects.length > 0) {
			return Console.error(Cause.pretty(cause)).pipe(Effect.andThen(Effect.failCause(cause)));
		}
		return Effect.failCause(cause);
	}),
);

NodeRuntime.runMain(main);
