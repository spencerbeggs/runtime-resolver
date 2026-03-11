import { Effect, Layer, Option } from "effect";
import { SemVer } from "semver-effect";
import { retryOnRateLimit } from "../lib/retry.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";

export const DenoVersionFetcherLive: Layer.Layer<DenoVersionFetcher, never, GitHubClient> = Layer.effect(
	DenoVersionFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;

		return {
			fetch: () =>
				Effect.gen(function* () {
					const releases = yield* retryOnRateLimit(client.listReleases("denoland", "deno", { perPage: 100, pages: 3 }));

					const versions: SemVer.SemVer[] = [];
					const inputs: RuntimeReleaseInput[] = [];

					for (const release of releases) {
						if (release.draft || release.prerelease) continue;
						const stripped = release.tag_name.startsWith("v") ? release.tag_name.slice(1) : release.tag_name;
						const opt = yield* SemVer.fromString(stripped).pipe(
							Effect.map(Option.some),
							Effect.catchAll(() => Effect.succeed(Option.none())),
						);
						if (Option.isSome(opt)) {
							versions.push(opt.value);
							inputs.push({
								version: stripped,
								date: release.published_at ?? new Date().toISOString().slice(0, 10),
							});
						}
					}

					return { versions, inputs };
				}),
		};
	}),
);
