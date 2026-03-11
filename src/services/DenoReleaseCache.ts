import { Context } from "effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

export type DenoReleaseCache = RuntimeCache<DenoRelease>;
export const DenoReleaseCache = Context.GenericTag<DenoReleaseCache>("DenoReleaseCache");
