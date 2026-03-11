import { Effect, Layer, Option, Schema } from "effect";
import { SemVer } from "semver-effect";
import { ParseError } from "../errors/ParseError.js";
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

					const versions: SemVer.SemVer[] = [];
					const inputs: NodeReleaseInput[] = [];

					for (const entry of allVersions) {
						const clean = entry.version.replace(/^v/, "");
						const parsed = yield* SemVer.fromString(clean).pipe(
							Effect.map(Option.some),
							Effect.catchAll(() => Effect.succeed(Option.none())),
						);
						if (Option.isSome(parsed)) {
							versions.push(parsed.value);
							inputs.push({
								version: clean,
								// Older entries (pre-v0.6.3) carry npm:false. Use "0.0.0" as a sentinel
								// since npm version is only informational and never used in comparisons.
								npm: typeof entry.npm === "string" ? entry.npm : "0.0.0",
								date: entry.date,
							});
						}
					}

					return { versions, inputs };
				}),
		};
	}),
);
