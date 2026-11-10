---
"runtime-resolver": patch
---

## Maintenance

Port the CLI's non-interactive `Terminal` stub to Effect 4.1.3, which adds a required `size` member. The stub dies if `size` is touched, like its other members; CLI behaviour is unchanged.
