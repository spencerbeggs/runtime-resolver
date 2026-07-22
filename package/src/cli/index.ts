#!/usr/bin/env node
import { Effect, Exit } from "effect";
import { Command } from "effect/unstable/cli";
import { cli } from "./command.js";
import { NodeCliEnvironment } from "./layers.js";
import { failureMessage } from "./report.js";

const version = process.env.__PACKAGE_VERSION__ ?? "0.0.0";

// Each runtime's resolver layer is provided inside its own flag-gated branch of
// the handler, so only requested runtimes are built. The bin only owns the
// process-level `Command.Environment`.
const program = Command.runWith(cli, { version })(process.argv.slice(2)).pipe(Effect.provide(NodeCliEnvironment));

const exit = await Effect.runPromiseExit(program);
if (Exit.isFailure(exit)) {
	process.exitCode = 1;
	const message = failureMessage(exit.cause);
	if (message !== null) {
		process.stderr.write(`${message}\n`);
	}
}
