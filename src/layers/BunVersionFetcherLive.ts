import { Effect, Layer, Option } from "effect";
import { SemVer } from "semver-effect";
import { retryOnRateLimit } from "../lib/retry.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { GitHubClient } from "../services/GitHubClient.js";

/**
 * Strip bun- prefix and v/V prefix, parse to SemVer.
 * Returns the parsed SemVer directly to avoid double parsing.
 */
const normalizeBunTag = (tagName: string): Effect.Effect<Option.Option<SemVer.SemVer>> => {
	const version = tagName.startsWith("bun-") ? tagName.slice(4) : tagName;
	const stripped = version.startsWith("v") || version.startsWith("V") ? version.slice(1) : version;
	return SemVer.fromString(stripped).pipe(
		Effect.map(Option.some),
		Effect.catchAll(() => Effect.succeed(Option.none())),
	);
};

export const BunVersionFetcherLive: Layer.Layer<BunVersionFetcher, never, GitHubClient> = Layer.effect(
	BunVersionFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;

		return {
			fetch: () =>
				Effect.gen(function* () {
					const releases = yield* retryOnRateLimit(client.listReleases("oven-sh", "bun", { perPage: 100, pages: 3 }));

					const versions: SemVer.SemVer[] = [];
					const inputs: RuntimeReleaseInput[] = [];

					for (const release of releases) {
						if (release.draft || release.prerelease) continue;
						const opt = yield* normalizeBunTag(release.tag_name);
						if (Option.isNone(opt)) continue;
						versions.push(opt.value);
						inputs.push({
							version: opt.value.toString(),
							date: release.published_at ?? new Date().toISOString().slice(0, 10),
						});
					}

					return { versions, inputs };
				}),
		};
	}),
);
