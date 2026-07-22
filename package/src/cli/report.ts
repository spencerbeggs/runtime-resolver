import { Cause, Option } from "effect";
import { CliError } from "effect/unstable/cli";

/**
 * The stderr line to print for a failed run, or `null` when nothing should be
 * printed because the CLI framework already rendered it.
 *
 * A `ShowHelp` failure has already written help + errors to the console, so it
 * returns `null`. A `UserError` carries an already-formatted message. Anything
 * else — a defect or interrupt with no typed failure — is surfaced through the
 * full cause rather than swallowed.
 */
export const failureMessage = (cause: Cause.Cause<CliError.CliError>): string | null => {
	const error = Cause.findErrorOption(cause);
	if (Option.isNone(error)) {
		return Cause.pretty(cause);
	}
	const value = error.value;
	if (CliError.isCliError(value) && value._tag === "ShowHelp") {
		return null;
	}
	if (value instanceof CliError.UserError) {
		return `error: ${String(value.cause)}`;
	}
	return `error: ${String(value)}`;
};
