import { Effect, Layer, Option, Schema } from "effect";
import { ParseError } from "../errors/ParseError.js";
import { tryParseSemVer } from "../lib/semver.js";
import { NodeDistIndex } from "../schemas/node.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";

const NODE_DIST_URL = "https://nodejs.org/dist/index.json";

const decodeDistIndex = (input: unknown) =>
	Schema.decodeUnknown(NodeDistIndex)(input).pipe(
		Effect.mapError(
			(e) =>
				new ParseError({
					source: NODE_DIST_URL,
					message: `Schema validation failed: ${e.message}`,
				}),
		),
	);

/**
 * Provides the {@link NodeVersionFetcher} service using the live Node.js dist index.
 *
 * Fetches the full Node.js version list from `https://nodejs.org/dist/index.json`
 * using the HTTP client on the provided {@link GitHubClient} service. Version
 * strings are normalized by stripping the leading `v` before parsing as semver.
 * Entries with non-string `npm` fields (present in very old releases prior to
 * v0.6.3) are substituted with the sentinel version `"0.0.0"`.
 *
 * This layer is a required dependency of {@link AutoNodeCacheLive} and
 * {@link FreshNodeCacheLive}. It is not needed by {@link OfflineNodeCacheLive}.
 *
 * @see {@link NodeVersionFetcher}
 * @see {@link GitHubClient}
 * @see {@link AutoNodeCacheLive}
 * @see {@link FreshNodeCacheLive}
 * @public
 */
export const NodeVersionFetcherLive: Layer.Layer<NodeVersionFetcher, never, GitHubClient> = Layer.effect(
	NodeVersionFetcher,
	Effect.gen(function* () {
		const client = yield* GitHubClient;

		return {
			fetch: () =>
				Effect.gen(function* () {
					const allVersions = yield* client.getJson(NODE_DIST_URL, {
						decode: decodeDistIndex,
					});

					const parsed = yield* Effect.forEach(
						allVersions,
						(entry) => {
							const clean = entry.version.replace(/^v/, "");
							return tryParseSemVer(clean).pipe(
								Effect.map((opt) =>
									Option.isSome(opt)
										? Option.some({
												version: opt.value,
												input: {
													version: clean,
													// Older entries (pre-v0.6.3) carry npm:false. Use "0.0.0" as a sentinel
													// since npm version is only informational and never used in comparisons.
													npm: typeof entry.npm === "string" ? entry.npm : "0.0.0",
													date: entry.date,
												} satisfies NodeReleaseInput,
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
