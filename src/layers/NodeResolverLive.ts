import { Effect, Layer, Schema } from "effect";
import * as semver from "semver";
import { ParseError } from "../errors/ParseError.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { findLatestLts, getVersionPhase } from "../lib/node-phases.js";
import { filterByIncrements, resolveVersionFromList } from "../lib/semver-utils.js";
import type { CachedNodeData } from "../schemas/cache.js";
import type { NodePhase } from "../schemas/common.js";
import { NodeDistIndex, NodeReleaseSchedule } from "../schemas/node.js";
import { GitHubClient } from "../services/GitHubClient.js";
import type { NodeResolverOptions } from "../services/NodeResolver.js";
import { NodeResolver } from "../services/NodeResolver.js";
import { VersionCache } from "../services/VersionCache.js";

const NODE_DIST_URL = "https://nodejs.org/dist/index.json";
const NODE_SCHEDULE_URL = "https://raw.githubusercontent.com/nodejs/Release/refs/heads/main/schedule.json";

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

const decodeSchedule = (input: unknown) =>
	Schema.decodeUnknown(NodeReleaseSchedule)(input).pipe(
		Effect.mapError(
			(e) =>
				new ParseError({
					source: NODE_SCHEDULE_URL,
					message: `Schema validation failed: ${e.message}`,
				}),
		),
	);

export const NodeResolverLive: Layer.Layer<NodeResolver, never, GitHubClient | VersionCache> = Layer.effect(
	NodeResolver,
	Effect.gen(function* () {
		const client = yield* GitHubClient;
		const cache = yield* VersionCache;

		const fetchNodeData = () =>
			Effect.gen(function* () {
				const [allVersions, schedule] = yield* Effect.all([
					client.getJson(NODE_DIST_URL, { decode: decodeDistIndex }),
					client.getJson(NODE_SCHEDULE_URL, { decode: decodeSchedule }),
				]);
				return { allVersions, schedule };
			});

		const fetchWithCacheFallback = () =>
			Effect.gen(function* () {
				const fromNetwork = fetchNodeData().pipe(
					Effect.tap(({ allVersions, schedule }) => cache.set("node", { versions: allVersions, schedule })),
					Effect.map(({ allVersions, schedule }) => ({ allVersions, schedule, source: "api" as const })),
				);

				return yield* fromNetwork.pipe(
					Effect.catchTag("NetworkError", () =>
						Effect.gen(function* () {
							const { data: cached, source } = yield* cache.get("node");
							const nodeCache = cached as CachedNodeData;
							return { allVersions: nodeCache.versions, schedule: nodeCache.schedule, source };
						}),
					),
				);
			});

		return {
			resolve: (options?: NodeResolverOptions) =>
				Effect.gen(function* () {
					const { allVersions, schedule, source } = yield* fetchWithCacheFallback();

					const phases: ReadonlyArray<NodePhase> = options?.phases ?? ["current", "active-lts"];
					const increments = options?.increments ?? "latest";
					const semverRange = options?.semverRange ?? ">=0.0.0";
					const now = options?.date ?? new Date();

					const cleanVersions = allVersions.map((v) => v.version.replace(/^v/, ""));

					const matchingVersions = cleanVersions.filter((version) => {
						if (!semver.satisfies(version, semverRange)) return false;
						const phase = getVersionPhase(version, schedule, now);
						if (!phase || !phases.includes(phase)) return false;
						return true;
					});

					const filteredVersions = filterByIncrements(matchingVersions, increments);
					const sortedVersions = semver.rsort([...filteredVersions]);

					let resolvedDefault: string | undefined;
					if (options?.defaultVersion) {
						resolvedDefault = resolveVersionFromList(options.defaultVersion, cleanVersions);

						if (resolvedDefault && !sortedVersions.includes(resolvedDefault)) {
							sortedVersions.push(resolvedDefault);
							sortedVersions.sort((a, b) => semver.rcompare(a, b));
						}
					}

					if (sortedVersions.length === 0) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "node",
								constraint: semverRange,
								message: `No Node.js versions found matching range "${semverRange}" with phases [${phases.join(", ")}]`,
							}),
						);
					}

					const latest = sortedVersions[0];
					const lts = findLatestLts(sortedVersions, schedule, now);

					return {
						source,
						versions: sortedVersions,
						latest,
						...(lts ? { lts } : {}),
						...(resolvedDefault ? { default: resolvedDefault } : {}),
					};
				}),

			resolveVersion: (versionOrRange: string) =>
				Effect.gen(function* () {
					if (semver.valid(versionOrRange)) {
						return versionOrRange;
					}

					const { allVersions } = yield* fetchWithCacheFallback();
					const cleanVersions = allVersions.map((v) => v.version.replace(/^v/, ""));
					const resolved = resolveVersionFromList(versionOrRange, cleanVersions);

					if (!resolved) {
						return yield* Effect.fail(
							new VersionNotFoundError({
								runtime: "node",
								constraint: versionOrRange,
								message: `No Node.js version found matching "${versionOrRange}"`,
							}),
						);
					}

					return resolved;
				}),
		};
	}),
);
