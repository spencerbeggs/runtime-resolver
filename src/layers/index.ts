import { Layer } from "effect";
import { BunResolverLive } from "./BunResolverLive.js";
import { DenoResolverLive } from "./DenoResolverLive.js";
import { GitHubClientLive } from "./GitHubClientLive.js";
import { GitHubTokenAuth } from "./GitHubTokenAuth.js";
import { NodeResolverLive } from "./NodeResolverLive.js";
import { VersionCacheLive } from "./VersionCacheLive.js";

export const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubTokenAuth));
export const SharedLayer = Layer.merge(GitHubLayer, VersionCacheLive);

export const NodeLayer = NodeResolverLive.pipe(Layer.provide(SharedLayer));
export const BunLayer = BunResolverLive.pipe(Layer.provide(SharedLayer));
export const DenoLayer = DenoResolverLive.pipe(Layer.provide(SharedLayer));
