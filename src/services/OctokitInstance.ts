import { Context } from "effect";

/**
 * Service interface for Octokit REST API client.
 */
export interface OctokitInstance {
	readonly rest: {
		readonly repos: {
			readonly listTags: (params: {
				owner: string;
				repo: string;
				per_page?: number;
				page?: number;
			}) => Promise<{ data: Array<unknown> }>;
			readonly listReleases: (params: {
				owner: string;
				repo: string;
				per_page?: number;
				page?: number;
			}) => Promise<{ data: Array<unknown> }>;
		};
	};
}

/** @deprecated Use {@link OctokitInstance} instead. */
export type OctokitLike = OctokitInstance;

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const OctokitInstance = Context.GenericTag<OctokitInstance>("OctokitInstance");
