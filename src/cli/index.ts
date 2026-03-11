#!/usr/bin/env node
/* v8 ignore start - CLI entry point requires integration testing */
import { Command } from "@effect/cli";
import { NodeContext, NodeRuntime } from "@effect/platform-node";
import { Cause, Console, Effect } from "effect";

import {
	appIdOption,
	appInstallationIdOption,
	appPrivateKeyOption,
	bunDefaultOption,
	bunOption,
	denoDefaultOption,
	denoOption,
	incrementsOption,
	nodeDateOption,
	nodeDefaultOption,
	nodeOption,
	nodePhasesOption,
	prettyOption,
	resolveHandler,
	schemaOption,
	tokenOption,
} from "./commands/resolve.js";

const rootCommand = Command.make(
	"runtime-resolver",
	{
		node: nodeOption,
		bun: bunOption,
		deno: denoOption,
		nodePhases: nodePhasesOption,
		increments: incrementsOption,
		nodeDefault: nodeDefaultOption,
		bunDefault: bunDefaultOption,
		denoDefault: denoDefaultOption,
		nodeDate: nodeDateOption,
		pretty: prettyOption,
		schema: schemaOption,
		token: tokenOption,
		appId: appIdOption,
		appPrivateKey: appPrivateKeyOption,
		appInstallationId: appInstallationIdOption,
	},
	resolveHandler,
);

const cli = Command.run(rootCommand, {
	name: "runtime-resolver",
	version: process.env.__PACKAGE_VERSION__ ?? "0.0.0",
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
