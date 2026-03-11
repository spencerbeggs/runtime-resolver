import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import { OctokitInstance } from "../services/OctokitInstance.js";

const resolveToken = Effect.sync(
	(): string => process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN || "",
);

/**
 * Provides an {@link OctokitInstance} authenticated with a GitHub personal
 * access token read from the environment at layer construction time.
 *
 * The token is resolved by checking, in order:
 * 1. `GITHUB_PERSONAL_ACCESS_TOKEN` environment variable
 * 2. `GITHUB_TOKEN` environment variable
 *
 * If neither variable is set the layer constructs an unauthenticated Octokit
 * instance (lower rate limits apply). This layer never fails.
 *
 * Use {@link GitHubTokenAuthFromToken} when you have the token value available
 * programmatically at construction time.
 *
 * @see {@link OctokitInstance}
 * @see {@link GitHubTokenAuthFromToken}
 * @see {@link GitHubAutoAuth}
 * @see {@link GitHubAppAuth}
 * @public
 */
export const GitHubTokenAuth: Layer.Layer<OctokitInstance> = Layer.effect(
	OctokitInstance,
	Effect.gen(function* () {
		const token = yield* resolveToken;
		return new Octokit(token ? { auth: token } : {});
	}),
);

/**
 * Provides an {@link OctokitInstance} authenticated with the given personal
 * access token string.
 *
 * Use this variant when the token is available as a value in your program
 * rather than read from an environment variable. The resulting layer never
 * fails.
 *
 * @param token - A GitHub personal access token string.
 *
 * @see {@link OctokitInstance}
 * @see {@link GitHubTokenAuth}
 * @see {@link GitHubAutoAuth}
 * @see {@link GitHubAppAuth}
 * @public
 */
export const GitHubTokenAuthFromToken = (token: string): Layer.Layer<OctokitInstance> =>
	Layer.succeed(OctokitInstance, new Octokit({ auth: token }));
