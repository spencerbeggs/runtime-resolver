import { Effect, Layer, Option } from "effect";
import { retryOnRateLimit } from "../lib/retry.js";
import { tryParseSemVer } from "../lib/semver.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";

/**
 * Provides the {@link DenoVersionFetcher} service using the live GitHub API.
 *
 * Fetches Deno releases from the `denoland/deno` GitHub repository using the
 * provided {@link GitHubClient}. Draft releases and pre-releases are excluded.
 * Tag names are normalized by stripping any leading `v` before parsing as
 * semver.
 *
 * This layer is a required dependency of {@link AutoDenoCacheLive} and
 * {@link FreshDenoCacheLive}. It is not needed by {@link OfflineDenoCacheLive}.
 *
 * @see {@link DenoVersionFetcher}
 * @see {@link GitHubClient}
 * @see {@link AutoDenoCacheLive}
 * @see {@link FreshDenoCacheLive}
 * @public
 */
export const DenoVersionFetcherLive: Layer.Layer<DenoVersionFetcher, never, GitHubClient> = Layer.effect(
	DenoVersionFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;

		return {
			fetch: () =>
				Effect.gen(function* () {
					const releases = yield* retryOnRateLimit(client.listReleases("denoland", "deno", { perPage: 100, pages: 3 }));
					const fallbackDate = new Date().toISOString().slice(0, 10);

					const parsed = yield* Effect.forEach(
						releases.filter((r) => !r.draft && !r.prerelease),
						(release) => {
							const stripped = release.tag_name.startsWith("v") ? release.tag_name.slice(1) : release.tag_name;
							return tryParseSemVer(stripped).pipe(
								Effect.map((opt) =>
									Option.isSome(opt)
										? Option.some({
												version: opt.value,
												input: {
													version: stripped,
													date: release.published_at ?? fallbackDate,
												} satisfies RuntimeReleaseInput,
											})
										: Option.none(),
								),
							);
						},
						{ concurrency: "unbounded" },
					);

					const versions = parsed.flatMap(Option.toArray).map(({ version }) => version);
					const inputs = parsed.flatMap(Option.toArray).map(({ input }) => input);

					return { versions, inputs };
				}),
		};
	}),
);
