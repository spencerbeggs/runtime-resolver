import { Effect, Layer, Option } from "effect";
import { retryOnRateLimit } from "../lib/retry.js";
import { tryParseSemVer } from "../lib/semver.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";

/**
 * Strip bun- prefix and v/V prefix, parse to SemVer.
 */
const normalizeBunTag = (tagName: string): Effect.Effect<Option.Option<import("semver-effect").SemVer>> => {
	const version = tagName.startsWith("bun-") ? tagName.slice(4) : tagName;
	const stripped = version.startsWith("v") || version.startsWith("V") ? version.slice(1) : version;
	return tryParseSemVer(stripped);
};

/**
 * Provides the {@link BunVersionFetcher} service using the live GitHub API.
 *
 * Fetches Bun releases from the `oven-sh/bun` GitHub repository using the
 * provided {@link GitHubClient}. Draft releases and pre-releases are excluded.
 * Tag names are normalized by stripping the `bun-` prefix and any leading `v`
 * or `V` before parsing as semver.
 *
 * This layer is a required dependency of {@link AutoBunCacheLive} and
 * {@link FreshBunCacheLive}. It is not needed by {@link OfflineBunCacheLive}.
 *
 * @see {@link BunVersionFetcher}
 * @see {@link GitHubClient}
 * @see {@link AutoBunCacheLive}
 * @see {@link FreshBunCacheLive}
 * @public
 */
export const BunVersionFetcherLive: Layer.Layer<BunVersionFetcher, never, GitHubClient> = Layer.effect(
	BunVersionFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;

		return {
			fetch: () =>
				Effect.gen(function* () {
					const releases = yield* retryOnRateLimit(client.listReleases("oven-sh", "bun", { perPage: 100, pages: 3 }));
					const fallbackDate = new Date().toISOString().slice(0, 10);

					const parsed = yield* Effect.forEach(
						releases.filter((r) => !r.draft && !r.prerelease),
						(release) =>
							normalizeBunTag(release.tag_name).pipe(
								Effect.map((opt) =>
									Option.isSome(opt)
										? Option.some({
												version: opt.value,
												input: {
													version: opt.value.toString(),
													date: release.published_at ?? fallbackDate,
												} satisfies RuntimeReleaseInput,
											})
										: Option.none(),
								),
							),
						{ concurrency: "unbounded" },
					);

					const versions = parsed.flatMap(Option.toArray).map(({ version }) => version);
					const inputs = parsed.flatMap(Option.toArray).map(({ input }) => input);

					return { versions, inputs };
				}),
		};
	}),
);
