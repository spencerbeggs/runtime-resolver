import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";

/**
 * Service for fetching Node.js release data from the official
 * Node.js distribution index.
 *
 * Retrieves both the parsed semver version list and the raw
 * {@link NodeReleaseInput} records needed to populate a
 * {@link NodeReleaseCache}. The live implementation fetches from
 * `https://nodejs.org/dist/index.json` via a plain HTTP request — no GitHub
 * credentials are required.
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
 * @see {@link NodeReleaseCache}
 * @see {@link NetworkError}
 * @see {@link ParseError}
 *
 * @public
 */
export class NodeVersionFetcher extends Context.Tag("runtime-resolver/NodeVersionFetcher")<
	NodeVersionFetcher,
	{
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
				readonly versions: ReadonlyArray<SemVer>;
				readonly inputs: ReadonlyArray<NodeReleaseInput>;
			},
			NetworkError | ParseError
		>;
	}
>() {}
