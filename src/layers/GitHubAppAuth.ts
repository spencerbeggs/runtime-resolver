import { createAppAuth } from "@octokit/auth-app";
import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";

/**
 * Configuration required to authenticate as a GitHub App installation.
 *
 * @see {@link GitHubAppAuth}
 * @public
 */
export interface GitHubAppAuthConfig {
	readonly appId: string;
	readonly privateKey: string;
	readonly installationId?: number;
}

const resolveInstallationId = async (
	auth: (opts: { type: "app" }) => Promise<{ token: string }>,
	installationId?: number,
): Promise<number> => {
	if (installationId) return installationId;

	const { token: jwt } = await auth({ type: "app" });

	const response = await fetch("https://api.github.com/app/installations?per_page=100", {
		headers: {
			Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json",
		},
	});

	if (!response.ok) {
		throw new Error(`Failed to list installations: ${response.status}`);
	}

	const installations = (await response.json()) as Array<{ id: number }>;

	if (installations.length === 0) {
		throw new Error("No installations found for this GitHub App");
	}

	// Use the first installation. Most apps have a single installation;
	// callers with multiple should pass installationId explicitly.
	return installations[0].id;
};

/**
 * Provides an {@link OctokitInstance} authenticated as a GitHub App installation.
 *
 * Accepts a {@link GitHubAppAuthConfig} and uses `@octokit/auth-app` to obtain
 * an installation access token. If `installationId` is omitted, the first
 * installation returned by the GitHub API is used automatically (suitable for
 * apps with a single installation). If authentication fails for any reason the
 * layer fails with an `AuthenticationError`.
 *
 * Use this auth method when your integration runs as a GitHub App rather than
 * as an individual user or a CI token.
 *
 * @param config - App credentials and optional installation ID.
 *
 * @see {@link GitHubAppAuthConfig}
 * @see {@link OctokitInstance}
 * @see {@link GitHubAutoAuth}
 * @see {@link GitHubTokenAuth}
 * @public
 */
export const GitHubAppAuth = (config: GitHubAppAuthConfig): Layer.Layer<OctokitInstance, AuthenticationError> =>
	Layer.effect(
		OctokitInstance,
		Effect.tryPromise({
			try: async () => {
				const auth = createAppAuth({
					appId: config.appId,
					privateKey: config.privateKey,
				});

				const resolvedId = await resolveInstallationId(auth, config.installationId);

				const result = await auth({
					type: "installation",
					installationId: resolvedId,
				});

				return new Octokit({ auth: result.token });
			},
			catch: (error) =>
				new AuthenticationError({
					method: "app",
					message: error instanceof Error ? error.message : String(error),
				}),
		}),
	);
