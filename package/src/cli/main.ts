import { Effect, Exit } from "effect";
import { Command } from "effect/cli";
import { cli } from "./command.js";
import { NodeCliEnvironment } from "./layers.js";
import { failureMessage } from "./report.js";

/**
 * Run the CLI over `argv` and set the process exit code from the result.
 *
 * Each runtime's resolver layer is provided inside its own flag-gated branch of
 * the handler, so only requested runtimes are built. The bin only owns the
 * process-level `Command.Environment`.
 */
export const main = async (argv: ReadonlyArray<string>): Promise<void> => {
	const version = process.env.__PACKAGE_VERSION__ ?? "0.0.0";
	const program = Command.runWith(cli, { version })(argv).pipe(Effect.provide(NodeCliEnvironment));

	const exit = await Effect.runPromiseExit(program);
	if (Exit.isFailure(exit)) {
		process.exitCode = 1;
		const message = failureMessage(exit.cause);
		if (message !== null) {
			process.stderr.write(`${message}\n`);
		}
	}
};
