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
