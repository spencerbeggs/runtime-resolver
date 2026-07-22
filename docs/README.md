# runtime-resolver documentation

`runtime-resolver` is a command-line tool that resolves semver-compatible versions of Node.js, Bun, and Deno runtimes and prints them as JSON, with an automatic fallback to a bundled offline snapshot.

## Install

```bash
npm install -g runtime-resolver
```

Or run it on demand without installing:

```bash
npx runtime-resolver --node ">=20"
```

The runtime dependencies (`effect`, `@effected/runtimes`, `@effected/semver`) install automatically — there are no peer dependencies to add by hand. Requires Node.js >=24.11.0.

## Quick start

```bash
npx runtime-resolver --node ">=20" --pretty
# {
#   "source": "api",
#   "versions": ["22.14.0", "20.19.0"],
#   "latest": "22.14.0",
#   "lts": "20.19.0",
#   "default": "20.19.0"
# }
```

Request several runtimes and the output becomes an object keyed by runtime name. The CLI exits `0` on success and non-zero on a usage error or resolution failure, writing a one-line `error: …` to stderr.

## Guides

| Guide | Description |
| ----- | ----------- |
| [CLI reference](./cli.md) | Flags, output format, exit codes, jq recipes, and CI/CD examples. |
| [Authentication](./authentication.md) | GitHub token detection order and offline fallback behavior. |
