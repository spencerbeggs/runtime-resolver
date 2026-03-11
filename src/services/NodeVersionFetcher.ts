import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";

export interface NodeVersionFetcher {
	readonly fetch: () => Effect.Effect<
		{
			readonly versions: ReadonlyArray<SemVer.SemVer>;
			readonly inputs: ReadonlyArray<NodeReleaseInput>;
		},
		NetworkError | ParseError
	>;
}

export const NodeVersionFetcher = Context.GenericTag<NodeVersionFetcher>("NodeVersionFetcher");
