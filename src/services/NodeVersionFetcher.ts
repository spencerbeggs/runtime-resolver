import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";

/**
 * Service interface for fetching Node.js release data from the official
 * Node.js distribution index.
 *
 * Retrieves both the parsed semver version list and the raw
 * {@link NodeReleaseInput} records needed to populate a
 * {@link NodeReleaseCache}. The live implementation fetches from
 * `https://nodejs.org/dist/index.json` via a plain HTTP request — no GitHub
 * credentials are required.
 *
 * @see {@link NodeVersionFetcherLive}
 * @see {@link NodeReleaseCache}
 * @see {@link NetworkError}
 * @see {@link ParseError}
 *
 * @public
 */
export interface NodeVersionFetcher {
	/**
	 * Fetches all available Node.js releases from the distribution index and
	 * returns both the parsed semver version objects and the raw release input
	 * records.
	 *
	 * Fails with:
	 * - {@link NetworkError} — the upstream request could not be completed.
	 * - {@link ParseError} — the response payload could not be decoded.
	 */
	readonly fetch: () => Effect.Effect<
		{
			readonly versions: ReadonlyArray<SemVer.SemVer>;
			readonly inputs: ReadonlyArray<NodeReleaseInput>;
		},
		NetworkError | ParseError
	>;
}

/**
 * Service tag and companion object for {@link NodeVersionFetcher}.
 *
 * Acts as both the TypeScript service interface and the Effect dependency tag
 * used for dependency injection (companion object pattern). Yield this tag
 * inside `Effect.gen` to access the fetcher implementation provided by
 * {@link NodeVersionFetcherLive}.
 *
 * @example
 * ```typescript
 * import type { NodeReleaseInput } from "runtime-resolver";
 * import { NodeVersionFetcher, NodeVersionFetcherLive } from "runtime-resolver";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 * 	const fetcher = yield* NodeVersionFetcher;
 * 	const { versions, inputs } = yield* fetcher.fetch();
 * 	console.log(`Fetched ${versions.length} Node.js releases`);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(NodeVersionFetcherLive)));
 * ```
 *
 * @see {@link NodeVersionFetcherLive}
 *
 * @public
 */
export const NodeVersionFetcher = Context.GenericTag<NodeVersionFetcher>("NodeVersionFetcher");
