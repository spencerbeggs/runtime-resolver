# Migrate from node-semver to semver-effect

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `semver` (node-semver) dependency with the Effect-native `semver-effect` library for all version parsing, comparison, range matching, and sorting operations.

**Architecture:** Keep the same string-based external interfaces (resolvers accept and return version strings). Internally, parse strings to `SemVer`/`Range` objects at the point of use via `Effect.gen`, use pure operations on the objects, and convert back to strings at output. For synchronous contexts (tag normalizers, phase detection), strip `v` prefixes manually and use `Effect.runSync` for validation.

**Tech Stack:** `semver-effect` (strict SemVer 2.0.0), `effect` (already a dependency)

**Key behavioral difference:** `semver-effect` is strict SemVer 2.0.0 and rejects `v` prefixes. The current code already strips `v` prefixes from Node versions (`v22.11.0` -> `22.11.0`). Tag normalizers need updating to strip `v` before validation. The `semver.valid()` function coerces `v1.2.3` to `1.2.3`; with semver-effect we strip manually then validate with `SemVer.fromString()`.

---

## File Structure

| File | Action | Purpose |
| ------ | -------- | --------- |
| `package.json` | Modify | Add `semver-effect`, remove `semver` + `@types/semver` |
| `src/lib/semver-utils.ts` | Rewrite | Replace node-semver calls with SemVer/Range from semver-effect |
| `src/lib/tag-normalizers.ts` | Rewrite | Strip `v` prefix manually, validate with SemVer.fromString |
| `src/lib/node-phases.ts` | Modify | Replace `semver.major()` and `semver.rsort()` |
| `src/layers/NodeResolverLive.ts` | Modify | Replace all semver imports/calls with semver-effect |
| `src/layers/BunResolverLive.ts` | Modify | Replace all semver imports/calls with semver-effect |
| `src/layers/DenoResolverLive.ts` | Modify | Replace all semver imports/calls with semver-effect |
| `src/lib/semver-utils.test.ts` | Verify | Existing tests should pass unchanged (same string interface) |
| `src/lib/tag-normalizers.test.ts` | Verify | Existing tests should pass unchanged |
| `src/services/BunResolver.test.ts` | Modify | Replace `semver.major()`/`semver.minor()` in assertions |
| `src/services/DenoResolver.test.ts` | Modify | Replace `semver.major()`/`semver.minor()` in assertions |
| `src/services/NodeResolver.test.ts` | Verify | No direct semver imports |

---

## Chunk 1: Foundation

### Task 1: Install semver-effect and verify

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install semver-effect**

```bash
pnpm add semver-effect
```

- [ ] **Step 2: Verify it resolves and the effect version is compatible**

```bash
pnpm ls semver-effect effect
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add semver-effect dependency

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 2: Rewrite tag-normalizers.ts

The tag normalizers are the simplest consumers. They use `semver.valid()` to validate and normalize version strings. With semver-effect, we strip the `v` prefix manually and use `SemVer.fromString()` via `Effect.runSync` for validation. The functions keep their synchronous `string | null` return type.

**Files:**

- Modify: `src/lib/tag-normalizers.ts`
- Test: `src/lib/tag-normalizers.test.ts` (verify existing tests pass)

- [ ] **Step 1: Run existing tag-normalizer tests to confirm baseline**

```bash
pnpm vitest run src/lib/tag-normalizers.test.ts
```

Expected: All pass.

- [ ] **Step 2: Rewrite tag-normalizers.ts**

```typescript
import { Effect } from "effect";
import { SemVer } from "semver-effect";

/**
 * Strips a leading "v" or "V" prefix from a version string.
 */
function stripVPrefix(input: string): string {
 return input.startsWith("v") || input.startsWith("V") ? input.slice(1) : input;
}

/**
 * Tries to parse a string as a valid semver version.
 * Returns the normalized version string or null if invalid.
 */
function tryParseSemVer(input: string): string | null {
 const stripped = stripVPrefix(input);
 return Effect.runSync(
  SemVer.fromString(stripped).pipe(
   Effect.map((v) => v.toString()),
   Effect.orElseSucceed(() => null),
  ),
 );
}

/**
 * Normalizes a Bun tag name to a valid semantic version.
 *
 * Bun uses different tag naming patterns:
 * - Modern releases: "bun-v1.2.3"
 * - Early releases: "v0.1.0"
 * - Development tags: "canary", "not-quite-v0"
 *
 * Strips the "bun-" prefix and validates the result is valid semver.
 */
export function normalizeBunTag(tagName: string): string | null {
 const version = tagName.startsWith("bun-") ? tagName.slice(4) : tagName;
 return tryParseSemVer(version);
}

/**
 * Normalizes a Deno tag name to a valid semantic version.
 *
 * Deno uses standard "v{semver}" format (e.g., "v2.7.3").
 * Strips the "v" prefix and validates the result is valid semver.
 */
export function normalizeDenoTag(tagName: string): string | null {
 return tryParseSemVer(tagName);
}
```

- [ ] **Step 3: Run tag-normalizer tests**

```bash
pnpm vitest run src/lib/tag-normalizers.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/tag-normalizers.ts
git commit -m "refactor: migrate tag-normalizers to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 3: Rewrite semver-utils.ts

The two utility functions (`filterByIncrements`, `resolveVersionFromList`) use `semver.parse()`, `semver.rsort()`, `semver.major()`, `semver.valid()`, `semver.satisfies()`. These are called from Effect.gen contexts in the resolvers, but the functions themselves are currently synchronous string-in/string-out.

**Strategy:** Keep the functions synchronous by using `Effect.runSync` for parsing. `SemVer.fromString` is a pure parser that doesn't need async. This avoids changing every call site.

**Files:**

- Modify: `src/lib/semver-utils.ts`
- Test: `src/lib/semver-utils.test.ts` (verify existing tests pass)

- [ ] **Step 1: Run existing tests to confirm baseline**

```bash
pnpm vitest run src/lib/semver-utils.test.ts
```

Expected: All pass.

- [ ] **Step 2: Rewrite semver-utils.ts**

```typescript
import { Effect, Option } from "effect";
import { Range, SemVer } from "semver-effect";
import type { Increments } from "../schemas/common.js";

/**
 * Tries to parse a version string, returning Option.
 */
function parseSemVer(input: string): Option.Option<SemVer> {
 return Effect.runSync(
  SemVer.fromString(input).pipe(
   Effect.map(Option.some),
   Effect.orElseSucceed(() => Option.none()),
  ),
 );
}

/**
 * Filters versions based on increment granularity.
 *
 * - "patch": Returns all versions (no filtering)
 * - "minor": Groups by major.minor, returns latest patch of each minor
 * - "latest": Groups by major, returns only the latest version of each major
 */
export function filterByIncrements(versions: string[], increment: Increments): string[] {
 if (increment === "patch") {
  return versions;
 }

 if (increment === "minor") {
  const minorGroups = new Map<string, { version: string; parsed: SemVer }[]>();
  for (const version of versions) {
   const opt = parseSemVer(version);
   if (Option.isNone(opt)) continue;
   const parsed = opt.value;

   const minorKey = `${parsed.major}.${parsed.minor}`;
   const group = minorGroups.get(minorKey);
   if (group) {
    group.push({ version, parsed });
   } else {
    minorGroups.set(minorKey, [{ version, parsed }]);
   }
  }

  const filtered: string[] = [];
  for (const group of minorGroups.values()) {
   const sorted = group.map((g) => g.parsed);
   const best = SemVer.rsort(sorted)[0];
   filtered.push(best.toString());
  }
  return filtered;
 }

 // increment === "latest"
 const majorGroups = new Map<number, { version: string; parsed: SemVer }[]>();
 for (const version of versions) {
  const opt = parseSemVer(version);
  if (Option.isNone(opt)) continue;
  const parsed = opt.value;

  const group = majorGroups.get(parsed.major);
  if (group) {
   group.push({ version, parsed });
  } else {
   majorGroups.set(parsed.major, [{ version, parsed }]);
  }
 }

 const filtered: string[] = [];
 for (const group of majorGroups.values()) {
  const sorted = group.map((g) => g.parsed);
  const best = SemVer.rsort(sorted)[0];
  filtered.push(best.toString());
 }
 return filtered;
}

/**
 * Resolves a semver range to the latest matching version from a list.
 * If the input is already a specific version, returns it as-is.
 */
export function resolveVersionFromList(versionOrRange: string, versions: string[]): string | undefined {
 // Check if it's an exact version
 const exactOpt = parseSemVer(versionOrRange);
 if (Option.isSome(exactOpt)) {
  return versions.includes(versionOrRange) ? versionOrRange : undefined;
 }

 // Try to parse as range
 const rangeResult = Effect.runSync(
  Range.fromString(versionOrRange).pipe(
   Effect.map(Option.some),
   Effect.orElseSucceed(() => Option.none()),
  ),
 );
 if (Option.isNone(rangeResult)) return undefined;
 const range = rangeResult.value;

 const parsed: SemVer[] = [];
 for (const v of versions) {
  const opt = parseSemVer(v);
  if (Option.isSome(opt) && Range.satisfies(opt.value, range)) {
   parsed.push(opt.value);
  }
 }

 if (parsed.length === 0) return undefined;

 return SemVer.rsort(parsed)[0].toString();
}
```

- [ ] **Step 3: Run semver-utils tests**

```bash
pnpm vitest run src/lib/semver-utils.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/semver-utils.ts
git commit -m "refactor: migrate semver-utils to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 4: Rewrite node-phases.ts

Uses `semver.major()` to extract the major version number and `semver.rsort()` for sorting. Replace with `SemVer.fromString` and `SemVer.rsort`.

**Files:**

- Modify: `src/lib/node-phases.ts`
- Test: (tested indirectly via NodeResolver.test.ts)

- [ ] **Step 1: Run Node resolver tests to confirm baseline**

```bash
pnpm vitest run src/services/NodeResolver.test.ts
```

Expected: All pass.

- [ ] **Step 2: Rewrite node-phases.ts**

```typescript
import { Effect, Option } from "effect";
import { SemVer } from "semver-effect";
import type { NodePhase } from "../schemas/common.js";
import type { NodeReleaseSchedule } from "../schemas/node.js";

/**
 * Determines the current phase of a Node.js version based on the release schedule.
 */
export function getVersionPhase(
 version: string,
 schedule: NodeReleaseSchedule,
 now: Date = new Date(),
): NodePhase | null {
 const parsed = Effect.runSync(
  SemVer.fromString(version).pipe(
   Effect.map(Option.some),
   Effect.orElseSucceed(() => Option.none()),
  ),
 );
 if (Option.isNone(parsed)) return null;

 const major = parsed.value.major;
 const majorKey = `v${major}`;
 const versionSchedule = schedule[majorKey];

 if (!versionSchedule) {
  return null;
 }

 const startDate = new Date(versionSchedule.start);
 const ltsDate = versionSchedule.lts ? new Date(versionSchedule.lts) : null;
 const maintenanceDate = versionSchedule.maintenance ? new Date(versionSchedule.maintenance) : null;
 const endDate = new Date(versionSchedule.end);

 if (now < startDate) {
  return null;
 }

 if (now >= endDate) {
  return "end-of-life";
 }

 if (maintenanceDate && now >= maintenanceDate) {
  return "maintenance-lts";
 }

 if (ltsDate && now >= ltsDate) {
  return "active-lts";
 }

 return "current";
}

/**
 * Returns the latest LTS version from the schedule that is currently in
 * active-lts or maintenance-lts phase.
 */
export function findLatestLts(
 versions: string[],
 schedule: NodeReleaseSchedule,
 now: Date = new Date(),
): string | undefined {
 const ltsVersions = versions.filter((v) => {
  const phase = getVersionPhase(v, schedule, now);
  return phase === "active-lts" || phase === "maintenance-lts";
 });

 if (ltsVersions.length === 0) return undefined;

 const parsed: SemVer[] = [];
 for (const v of ltsVersions) {
  const result = Effect.runSync(
   SemVer.fromString(v).pipe(
    Effect.map(Option.some),
    Effect.orElseSucceed(() => Option.none()),
   ),
  );
  if (Option.isSome(result)) {
   parsed.push(result.value);
  }
 }

 if (parsed.length === 0) return undefined;

 return SemVer.rsort(parsed)[0].toString();
}
```

- [ ] **Step 3: Run Node resolver tests**

```bash
pnpm vitest run src/services/NodeResolver.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/node-phases.ts
git commit -m "refactor: migrate node-phases to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 2: Resolver Layers

### Task 5: Rewrite NodeResolverLive.ts

Replace all `semver.*` calls. Since this code is already in `Effect.gen`, we can use `yield*` for parsing ranges and version validation. For batch operations in `.filter()` callbacks, use `Effect.runSync` since `SemVer.fromString` and `Range.satisfies` are pure.

**Files:**

- Modify: `src/layers/NodeResolverLive.ts`
- Test: `src/services/NodeResolver.test.ts` (verify all pass)

- [ ] **Step 1: Rewrite NodeResolverLive.ts**

Replace the import and all semver usages:

```typescript
// Replace: import * as semver from "semver";
// With:
import { Option } from "effect";
import { Range, SemVer } from "semver-effect";
```

Key replacements in the `resolve` method:

- `semver.validRange(semverRange)` -> `yield* Range.fromString(semverRange).pipe(Effect.mapError(...))` — parse range once, catch `InvalidRangeError` and map to `InvalidInputError`
- `semver.satisfies(version, semverRange)` -> Parse each version with `SemVer.fromString` (via Effect.runSync + Option), then `Range.satisfies(parsed, range)`
- `semver.rsort([...filteredVersions])` -> Parse to SemVer[], `SemVer.rsort(parsed)`, map back to strings
- `semver.rcompare(a, b)` -> `SemVer.compare(b, a)` (or use SemVer.rsort)
- `semver.valid(versionOrRange)` in `resolveVersion` -> `SemVer.fromString` via Effect.runSync + Option

Full replacement for the resolve method's range validation and filtering:

```typescript
// Validate range — yield* since we're in Effect.gen
const range = yield* Range.fromString(semverRange).pipe(
 Effect.mapError(() =>
  new InvalidInputError({
   field: "semverRange",
   value: semverRange,
   message: `Invalid semver range: "${semverRange}"`,
  }),
 ),
);

// Filter versions using parsed range
const matchingVersions = cleanVersions.filter((version) => {
 const opt = Effect.runSync(
  SemVer.fromString(version).pipe(
   Effect.map(Option.some),
   Effect.orElseSucceed(() => Option.none()),
  ),
 );
 if (Option.isNone(opt)) return false;
 if (!Range.satisfies(opt.value, range)) return false;
 const phase = getVersionPhase(version, schedule, now);
 if (!phase || !phases.includes(phase)) return false;
 return true;
});
```

For sorting:

```typescript
// Parse, sort, convert back to strings
const parsedFiltered = filteredVersions
 .map((v) => Effect.runSync(SemVer.fromString(v).pipe(Effect.map(Option.some), Effect.orElseSucceed(() => Option.none()))))
 .filter(Option.isSome)
 .map((o) => o.value);
const sortedVersions = SemVer.rsort(parsedFiltered).map((v) => v.toString());
```

For `resolveVersion`:

```typescript
// Replace semver.valid() check
const exactOpt = Effect.runSync(
 SemVer.fromString(versionOrRange).pipe(
  Effect.map(Option.some),
  Effect.orElseSucceed(() => Option.none()),
 ),
);
if (Option.isSome(exactOpt)) {
 // ... exact version logic
}

// Replace semver.validRange() check
const rangeOpt = Effect.runSync(
 Range.fromString(versionOrRange).pipe(
  Effect.map(Option.some),
  Effect.orElseSucceed(() => Option.none()),
 ),
);
if (Option.isNone(rangeOpt)) {
 return yield* Effect.fail(new InvalidInputError({ ... }));
}
```

- [ ] **Step 2: Run Node resolver tests**

```bash
pnpm vitest run src/services/NodeResolver.test.ts
```

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add src/layers/NodeResolverLive.ts
git commit -m "refactor: migrate NodeResolverLive to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 6: Rewrite BunResolverLive.ts

Same pattern as NodeResolverLive. Also update `tagsToVersions` which uses `semver.rsort`.

**Files:**

- Modify: `src/layers/BunResolverLive.ts`
- Test: `src/services/BunResolver.test.ts`

- [ ] **Step 1: Rewrite BunResolverLive.ts**

Replace import and all semver calls. The `tagsToVersions` function becomes:

```typescript
import { Option } from "effect";
import { Range, SemVer } from "semver-effect";

const tagsToVersions = (tags: ReadonlyArray<GitHubTag>): string[] => {
 const parsed: SemVer[] = [];
 for (const tag of tags) {
  const normalized = normalizeBunTag(tag.name);
  if (normalized) {
   const opt = Effect.runSync(
    SemVer.fromString(normalized).pipe(
     Effect.map(Option.some),
     Effect.orElseSucceed(() => Option.none()),
    ),
   );
   if (Option.isSome(opt)) {
    parsed.push(opt.value);
   }
  }
 }
 return SemVer.rsort(parsed).map((v) => v.toString());
};
```

Apply the same pattern as Task 5 for `resolve` and `resolveVersion` methods.

- [ ] **Step 2: Update BunResolver.test.ts — remove semver import**

Replace:

```typescript
import * as semver from "semver";
```

In the "increments 'latest'" test, replace:

```typescript
const majors = result.versions.map((v) => semver.major(v));
```

With:

```typescript
const majors = result.versions.map((v) => Number.parseInt(v.split(".")[0], 10));
```

In the "increments 'minor'" test, replace:

```typescript
const minors = result.versions.map((v) => `${semver.major(v)}.${semver.minor(v)}`);
```

With:

```typescript
const minors = result.versions.map((v) => { const [maj, min] = v.split("."); return `${maj}.${min}`; });
```

- [ ] **Step 3: Run Bun resolver tests**

```bash
pnpm vitest run src/services/BunResolver.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/layers/BunResolverLive.ts src/services/BunResolver.test.ts
git commit -m "refactor: migrate BunResolverLive to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 7: Rewrite DenoResolverLive.ts

Identical pattern to BunResolverLive (they share the same structure).

**Files:**

- Modify: `src/layers/DenoResolverLive.ts`
- Modify: `src/services/DenoResolver.test.ts`

- [ ] **Step 1: Rewrite DenoResolverLive.ts**

Same pattern as Task 6. Update `tagsToVersions` and all semver calls.

- [ ] **Step 2: Update DenoResolver.test.ts — remove semver import**

Same pattern as Task 6 step 2: replace `semver.major()` and `semver.minor()` with string splitting.

- [ ] **Step 3: Run Deno resolver tests**

```bash
pnpm vitest run src/services/DenoResolver.test.ts
```

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/layers/DenoResolverLive.ts src/services/DenoResolver.test.ts
git commit -m "refactor: migrate DenoResolverLive to semver-effect

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 3: Cleanup and Verification

### Task 8: Remove semver and @types/semver dependencies

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Remove old dependencies**

```bash
pnpm remove semver @types/semver
```

- [ ] **Step 2: Verify no remaining imports of "semver"**

```bash
grep -r 'from "semver"' src/
```

Expected: No matches.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: remove semver and @types/semver dependencies

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run all tests**

```bash
pnpm run test
```

Expected: All pass.

- [ ] **Step 2: Run typecheck**

```bash
pnpm run typecheck
```

Expected: No errors.

- [ ] **Step 3: Run linter**

```bash
pnpm run lint:fix
```

Expected: Clean (auto-fix any import ordering changes).

- [ ] **Step 4: Final commit if any lint fixes**

```bash
git add -A
git commit -m "style: lint fixes after semver-effect migration

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Helper Pattern Reference

The `parseSemVer` -> `Option` pattern appears frequently. If duplication becomes excessive during implementation, consider extracting a shared helper to a common location. But start without it — DRY only when the pattern is confirmed stable across all files.

```typescript
// Reusable pattern for synchronous SemVer parsing in filter/map callbacks
const opt = Effect.runSync(
 SemVer.fromString(input).pipe(
  Effect.map(Option.some),
  Effect.orElseSucceed(() => Option.none()),
 ),
);
```
