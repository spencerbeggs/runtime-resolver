import { createAppAuth } from "@octokit/auth-app";
import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";

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

	return installations[0].id;
};

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
