import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

export const GitHubAutoAuth: Layer.Layer<OctokitInstance, AuthenticationError> = Layer.effect(
	OctokitInstance,
	Effect.gen(function* () {
		const appId = process.env.GITHUB_APP_ID;
		const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
		const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
		const pat = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
		const token = process.env.GITHUB_TOKEN;

		const hasApp = appId && privateKey;
		const hasToken = pat || token;

		// Warn when multiple credential sources are detected
		if (hasApp && hasToken) {
			const tokenSource = pat ? "GITHUB_PERSONAL_ACCESS_TOKEN" : "GITHUB_TOKEN";
			yield* Effect.logWarning(
				`Multiple GitHub credential sources found. Using GitHub App authentication (from GITHUB_APP_ID). Ignoring ${tokenSource}.`,
			);
		}

		// Priority 1: App env vars
		if (hasApp) {
			const appLayer = GitHubAppAuth({
				appId: appId,
				privateKey: privateKey,
				...(installationId ? { installationId: Number(installationId) } : {}),
			});
			return yield* Effect.provide(OctokitInstance, appLayer);
		}

		// Priority 2: Token env vars (PAT first, then GITHUB_TOKEN)
		if (pat) {
			return new Octokit({ auth: pat });
		}
		if (token) {
			return new Octokit({ auth: token });
		}

		// Priority 3: Unauthenticated
		return new Octokit();
	}),
);
