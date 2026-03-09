import { Context } from "effect";

export interface OctokitLike {
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

export class OctokitInstance extends Context.Tag("OctokitInstance")<OctokitInstance, OctokitLike>() {}
