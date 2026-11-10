# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Status

This is a **base template repository** in initial state. The design
documentation system (`.claude/` skills and agents) is included but no design
docs exist yet. To begin planning and documenting architecture decisions, run
`/design-init` to create your first design document.

## Commands

### Development

```bash
pnpm run lint              # Check code with Biome
pnpm run lint:fix          # Auto-fix lint issues
pnpm run typecheck         # Type-check all workspaces via Turbo
pnpm run test              # Run all tests
pnpm run test:watch        # Run tests in watch mode
pnpm run test:coverage     # Run tests with coverage report
```

### Building

```bash
pnpm run build             # Build the package with `effected package build`
```

### Running a Single Test

```bash
# Run tests for a specific package
pnpm run test -- --filter=@spencerbeggs/ecma-module

# Run a specific test file
pnpm vitest run pkgs/ecma-module/src/index.test.ts
```

## Architecture

### Monorepo Structure

- **Package Manager**: pnpm with workspaces
- **Build Orchestration**: Turbo for caching and task dependencies
- **Packages**: Located in `pkgs/` directory
- **Shared Configs**: Located in `lib/configs/`

### Package Build Pipeline

The publishable member, `package/`, builds with `effected package build` (from
`@effected/plugin`), configured by `package/effected.toml`. It is bin-only, so
the build emits no declarations and no API model. Output lands in
`dist/prod/<target>/pkg` for each `publishConfig.targets` entry (`npm`,
`github`), with `dist/prod/issues.json` holding the build's diagnostics.

There is no dev build and no link directory: the root's `workspace:*` link
resolves to `package/` source, and the bin registers tsx itself when it runs
from `.ts`. Turbo's `build` depends on `types:check`, which needs no build.

### Code Quality

- **Biome**: Unified linting and formatting (replaces ESLint + Prettier)
- **Commitlint**: Enforces conventional commits with DCO signoff
- **Husky Hooks**:
  - `pre-commit`: Runs lint-staged
  - `commit-msg`: Validates commit message format
  - `pre-push`: Runs tests for affected packages

### TypeScript Configuration

- Composite builds with project references
- Strict mode enabled
- ES2022/ES2023 targets
- Import extensions required (`.js` for ESM)

### Testing

- **Framework**: Vitest with v8 coverage
- **Pool**: Uses forks (not threads) for Effect-TS compatibility
- **Config**: `vitest.config.ts` supports project-based filtering via
  `--project` flag

## Conventions

### Imports

- Use `.js` extensions for relative imports (ESM requirement)
- Use `node:` protocol for Node.js built-ins
- Separate type imports: `import type { Foo } from './bar.js'`

### Commits

All commits require:

1. Conventional commit format (feat, fix, chore, etc.)
2. DCO signoff: `Signed-off-by: Name <email>`

### Publishing

Packages publish to both GitHub Packages and npm with provenance.
