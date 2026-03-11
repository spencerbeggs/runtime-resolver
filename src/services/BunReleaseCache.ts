import { Context } from "effect";
import type { BunRelease } from "../schemas/bun-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

export type BunReleaseCache = RuntimeCache<BunRelease>;
export const BunReleaseCache = Context.GenericTag<BunReleaseCache>("BunReleaseCache");
