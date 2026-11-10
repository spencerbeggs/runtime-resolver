---
"runtime-resolver": patch
---

## Build System

Build with `effected package build` instead of `@savvy-web/bundler`. The published package keeps the same `runtime-resolver` bin and behaviour. The bin entry is now a thin loader over a `main` module, so the source bin linked into the workspace registers tsx itself and runs outside pnpm scripts.
