import { build } from "@savvy-web/bundler";

// Bin-only package: the `runtime-resolver` binary is the sole output. There is
// no exports map, so there are no `@public` declarations for API Extractor to
// read — `meta: false` opts out of the prod API-model pass, which otherwise
// aborts the prod build with "Cannot merge zero API models".
await build({ meta: false });
