import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import type { AuthenticationError } from "../errors/AuthenticationError.js";
import { OctokitInstance } from "../services/OctokitInstance.js";
import { GitHubAppAuth } from "./GitHubAppAuth.js";

/**
 * Provides an {@link OctokitInstance} by auto-detecting the available
 * authentication credentials from environment variables at layer construction
 * time.
 *
 * Credentials are evaluated in the following priority order:
 * 1. **GitHub App** — when both `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY`
 *    are set, authenticates as a GitHub App installation via {@link GitHubAppAuth}.
 *    `GITHUB_APP_INSTALLATION_ID` is optional; if absent the first installation
 *    is used automatically.
 * 2. **Personal Access Token** — when `GITHUB_PERSONAL_ACCESS_TOKEN` is set,
 *    authenticates with that token.
 * 3. **`GITHUB_TOKEN`** — when `GITHUB_TOKEN` is set (e.g., the default token
 *    injected in GitHub Actions), authenticates with that token.
 * 4. **Unauthenticated** — falls back to an unauthenticated Octokit instance
 *    when no credentials are found (lower rate limits apply).
 *
 * If both App and token credentials are present, App auth takes precedence and
 * a warning is logged. This layer fails with `AuthenticationError` only when
 * App credentials are present but the App authentication itself fails.
 *
 * Use this layer as the default auth strategy in most applications. Switch to
 * {@link GitHubTokenAuth} or {@link GitHubAppAuth} when you need explicit control
 * over which credential source is used.
 *
 * @example
 * ```ts
 * import { GitHubClientLive, GitHubAutoAuth } from "runtime-resolver";
 * import { Layer } from "effect";
 *
 * const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
 * ```
 *
 * @see {@link OctokitInstance}
 * @see {@link GitHubTokenAuth}
 * @see {@link GitHubAppAuth}
 * @public
 */
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
