import { Effect, Layer } from "effect";
import { Octokit } from "octokit";
import { OctokitInstance } from "../services/OctokitInstance.js";

const resolveToken = Effect.sync(
	(): string => process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_TOKEN || "",
);

export const GitHubTokenAuth: Layer.Layer<OctokitInstance> = Layer.effect(
	OctokitInstance,
	Effect.gen(function* () {
		const token = yield* resolveToken;
		return new Octokit(token ? { auth: token } : {});
	}),
);

export const GitHubTokenAuthFromToken = (token: string): Layer.Layer<OctokitInstance> =>
	Layer.succeed(OctokitInstance, new Octokit({ auth: token }));
