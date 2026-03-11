# Effect Domain Model Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw JSON storage with Effect-native domain classes, generic cache layer, decomposed fetchers, freshness-as-Layers, lean defaults, and CI auto-release.

**Architecture:** Domain classes (`NodeRelease`, `BunRelease`, `DenoRelease`) wrap parsed SemVer and DateTime. A generic `RuntimeCache<R>` wraps semver-effect's `VersionCache` with typed release lookup. Freshness is a Layer composition concern (Auto/Fresh/Offline variants). Generated defaults shrink from raw JSON to lean typed input arrays.

**Tech Stack:** Effect (Data, Schema, Ref, Layer), semver-effect (SemVer, Range, VersionCache, SemVerParser), Vitest

**Spec:** `docs/superpowers/specs/2026-03-11-effect-domain-model-design.md`

**Note on `Effect.runSync`:** This codebase uses `Effect.runSync` inside synchronous callbacks (e.g., `Array.filter`, `Array.map`, tag normalizers) where the underlying effects are infallible or produce `Option`. This is an established pattern in the codebase. Do not refactor these to effectful pipelines unless specifically asked.

---

## Chunk 1: Domain Model (Phase 1)

### Task 1: RuntimeRelease Interface and RuntimeReleaseInput Schema

**Files:**

- Create: `src/schemas/runtime-release.ts`
- Test: `src/schemas/runtime-release.test.ts`

**Context:** This is the base constraint that all release classes satisfy. It enables the generic `RuntimeCache<R>`. `RuntimeReleaseInput` is the lean shape that Bun/Deno defaults generators write and factories consume.

- [ ] **Step 1: Write the failing test**

```typescript
// src/schemas/runtime-release.test.ts
import { DateTime } from "effect";
import { describe, expect, it } from "vitest";
import { SemVer } from "semver-effect";
import { RuntimeReleaseInput } from "./runtime-release.js";
import { Schema } from "effect";

describe("RuntimeReleaseInput", () => {
 it("decodes a valid input", () => {
  const result = Schema.decodeUnknownSync(RuntimeReleaseInput)({
   version: "1.2.3",
   date: "2025-01-15",
  });
  expect(result.version).toBe("1.2.3");
  expect(result.date).toBe("2025-01-15");
 });

 it("rejects missing version", () => {
  expect(() =>
   Schema.decodeUnknownSync(RuntimeReleaseInput)({ date: "2025-01-15" }),
  ).toThrow();
 });

 it("rejects missing date", () => {
  expect(() =>
   Schema.decodeUnknownSync(RuntimeReleaseInput)({ version: "1.2.3" }),
  ).toThrow();
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/schemas/runtime-release.test.ts`
Expected: FAIL — module `./runtime-release.js` not found

- [ ] **Step 3: Write the RuntimeRelease interface and RuntimeReleaseInput schema**

```typescript
// src/schemas/runtime-release.ts
import type { DateTime } from "effect";
import { Schema } from "effect";
import type { SemVer } from "semver-effect";

/**
 * Base constraint for all runtime release classes.
 * Enables generic RuntimeCache<R extends RuntimeRelease>.
 */
export interface RuntimeRelease {
 readonly _tag: string;
 readonly version: SemVer.SemVer;
 readonly date: DateTime.DateTime;
}

/**
 * Lean input schema for Bun/Deno release construction.
 * This is the shape generated defaults files export.
 */
export const RuntimeReleaseInput = Schema.Struct({
 version: Schema.String,
 date: Schema.String,
});
export type RuntimeReleaseInput = typeof RuntimeReleaseInput.Type;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/schemas/runtime-release.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/schemas/runtime-release.ts src/schemas/runtime-release.test.ts
git commit -m "feat: add RuntimeRelease interface and RuntimeReleaseInput schema

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 2: NodeSchedule Domain Class

**Files:**

- Create: `src/schemas/node-schedule.ts`
- Test: `src/schemas/node-schedule.test.ts`

**Context:** `NodeSchedule` is a `Data.TaggedClass` holding schedule entries. It lives in a `Ref<NodeSchedule>` singleton. Key method `phaseFor(major, now)` determines a Node.js version's lifecycle phase. `NodeScheduleData` is the raw JSON shape from the Node.js Release repo. The `fromData` factory parses dates and normalizes codenames.

- [ ] **Step 1: Write the failing test**

```typescript
// src/schemas/node-schedule.test.ts
import { DateTime, Effect } from "effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "./node-schedule.js";
import { NodeSchedule } from "./node-schedule.js";

const scheduleData: NodeScheduleData = {
 v20: {
  start: "2023-04-18",
  lts: "2023-10-24",
  maintenance: "2024-10-22",
  end: "2026-04-30",
  codename: "Iron",
 },
 v22: {
  start: "2024-04-24",
  lts: "2024-10-29",
  maintenance: "2025-10-21",
  end: "2027-04-30",
  codename: "Jod",
 },
 v23: {
  start: "2024-10-16",
  end: "2025-06-01",
 },
 v24: {
  start: "2025-04-22",
  lts: "2025-10-28",
  maintenance: "2026-10-20",
  end: "2028-04-30",
 },
};

describe("NodeSchedule", () => {
 it("creates from raw schedule data", () => {
  const schedule = NodeSchedule.fromData(scheduleData);
  expect(schedule._tag).toBe("NodeSchedule");
  expect(schedule.entries.length).toBe(4);
 });

 it("normalizes codename to empty string when absent", () => {
  const schedule = NodeSchedule.fromData(scheduleData);
  const v23Entry = schedule.entries.find((e) => e.major === 23);
  expect(v23Entry?.codename).toBe("");
  const v24Entry = schedule.entries.find((e) => e.major === 24);
  expect(v24Entry?.codename).toBe("");
 });

 it("preserves codename when present", () => {
  const schedule = NodeSchedule.fromData(scheduleData);
  const v22Entry = schedule.entries.find((e) => e.major === 22);
  expect(v22Entry?.codename).toBe("Jod");
 });

 describe("phaseFor", () => {
  const schedule = NodeSchedule.fromData(scheduleData);

  it("returns 'current' before LTS date", () => {
   const now = DateTime.unsafeMake("2024-06-15");
   const phase = Effect.runSync(schedule.phaseFor(22, now));
   expect(phase).toBe("current");
  });

  it("returns 'active-lts' after LTS date", () => {
   const now = DateTime.unsafeMake("2024-11-15");
   const phase = Effect.runSync(schedule.phaseFor(22, now));
   expect(phase).toBe("active-lts");
  });

  it("returns 'maintenance-lts' after maintenance date", () => {
   const now = DateTime.unsafeMake("2025-11-15");
   const phase = Effect.runSync(schedule.phaseFor(22, now));
   expect(phase).toBe("maintenance-lts");
  });

  it("returns 'end-of-life' after end date", () => {
   const now = DateTime.unsafeMake("2027-05-01");
   const phase = Effect.runSync(schedule.phaseFor(22, now));
   expect(phase).toBe("end-of-life");
  });

  it("returns null before start date", () => {
   const now = DateTime.unsafeMake("2025-01-01");
   const phase = Effect.runSync(schedule.phaseFor(24, now));
   expect(phase).toBeNull();
  });

  it("returns null for unknown major", () => {
   const now = DateTime.unsafeMake("2025-01-01");
   const phase = Effect.runSync(schedule.phaseFor(99, now));
   expect(phase).toBeNull();
  });

  it("returns 'current' for odd version (never LTS)", () => {
   const now = DateTime.unsafeMake("2024-11-01");
   const phase = Effect.runSync(schedule.phaseFor(23, now));
   expect(phase).toBe("current");
  });
 });

 describe("entryFor", () => {
  const schedule = NodeSchedule.fromData(scheduleData);

  it("returns Some for known major", () => {
   const entry = schedule.entryFor(22);
   expect(entry._tag).toBe("Some");
  });

  it("returns None for unknown major", () => {
   const entry = schedule.entryFor(99);
   expect(entry._tag).toBe("None");
  });
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/schemas/node-schedule.test.ts`
Expected: FAIL — module `./node-schedule.js` not found

- [ ] **Step 3: Write NodeSchedule implementation**

```typescript
// src/schemas/node-schedule.ts
import { Data, DateTime, Effect, Option } from "effect";
import type { NodePhase } from "./common.js";

/**
 * A single entry in the Node.js release schedule.
 */
export interface NodeScheduleEntry {
 readonly major: number;
 readonly start: DateTime.DateTime;
 readonly lts: DateTime.DateTime | null;
 readonly maintenance: DateTime.DateTime | null;
 readonly end: DateTime.DateTime;
 readonly codename: string;
}

/**
 * Raw schedule format as fetched from the Node.js Release repo.
 * Intermediate type between fetcher and NodeSchedule class.
 */
export type NodeScheduleData = Record<
 string,
 {
  readonly start: string;
  readonly lts?: string;
  readonly maintenance?: string;
  readonly end: string;
  readonly codename?: string;
 }
>;

const NodeScheduleBase = Data.TaggedClass("NodeSchedule");

/**
 * Immutable schedule holding all Node.js release schedule entries.
 * Lives in a Ref<NodeSchedule> singleton for shared mutable access.
 */
export class NodeSchedule extends NodeScheduleBase<{
 readonly entries: ReadonlyArray<NodeScheduleEntry>;
}> {
 /**
  * Parse raw schedule JSON into a NodeSchedule instance.
  * Converts date strings to DateTime and normalizes codenames.
  */
 static fromData(data: NodeScheduleData): NodeSchedule {
  const entries: NodeScheduleEntry[] = [];
  for (const [key, value] of Object.entries(data)) {
   const major = Number.parseInt(key.replace("v", ""), 10);
   if (Number.isNaN(major)) continue;
   entries.push({
    major,
    start: DateTime.unsafeMake(value.start),
    lts: value.lts ? DateTime.unsafeMake(value.lts) : null,
    maintenance: value.maintenance ? DateTime.unsafeMake(value.maintenance) : null,
    end: DateTime.unsafeMake(value.end),
    codename: value.codename ?? "",
   });
  }
  return new NodeSchedule({ entries });
 }

 /**
  * Determines the current phase of a Node.js major version.
  * Returns null if the major is unknown or not yet released.
  */
 phaseFor(major: number, now: DateTime.DateTime): Effect.Effect<NodePhase | null> {
  return Effect.sync(() => {
   const entry = this.entries.find((e) => e.major === major);
   if (!entry) return null;

   if (DateTime.lessThan(now, entry.start)) return null;
   if (DateTime.greaterThanOrEqualTo(now, entry.end)) return "end-of-life";
   if (entry.maintenance && DateTime.greaterThanOrEqualTo(now, entry.maintenance))
    return "maintenance-lts";
   if (entry.lts && DateTime.greaterThanOrEqualTo(now, entry.lts)) return "active-lts";
   return "current";
  });
 }

 /**
  * Look up the schedule entry for a given major version.
  */
 entryFor(major: number): Option.Option<NodeScheduleEntry> {
  const entry = this.entries.find((e) => e.major === major);
  return entry ? Option.some(entry) : Option.none();
 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/schemas/node-schedule.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add src/schemas/node-schedule.ts src/schemas/node-schedule.test.ts
git commit -m "feat: add NodeSchedule domain class with phaseFor and entryFor

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 3: NodeReleaseInput Schema and NodeRelease Class

**Files:**

- Create: `src/schemas/node-release.ts`
- Test: `src/schemas/node-release.test.ts`
- Modify: `src/schemas/node.ts` (remove pseudo-code NodeRelease, keep NodeDistIndex)

**Context:** `NodeRelease` is a plain class (not `Data.TaggedClass`) because it holds a `Ref<NodeSchedule>`. It has effectful computed properties `phase()` and `lts()` that read from the shared Ref. The `fromInput` factory parses strings to SemVer/DateTime.

- [ ] **Step 1: Write the failing test**

```typescript
// src/schemas/node-release.test.ts
import { DateTime, Effect, Ref } from "effect";
import { SemVer } from "semver-effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "./node-schedule.js";
import { NodeSchedule } from "./node-schedule.js";
import { NodeRelease, NodeReleaseInput } from "./node-release.js";
import { Schema } from "effect";

const scheduleData: NodeScheduleData = {
 v22: {
  start: "2024-04-24",
  lts: "2024-10-29",
  maintenance: "2025-10-21",
  end: "2027-04-30",
  codename: "Jod",
 },
 v24: {
  start: "2025-04-22",
  lts: "2025-10-28",
  maintenance: "2026-10-20",
  end: "2028-04-30",
 },
};

describe("NodeReleaseInput", () => {
 it("decodes a valid input", () => {
  const result = Schema.decodeUnknownSync(NodeReleaseInput)({
   version: "22.11.0",
   npm: "10.9.0",
   date: "2024-11-15",
  });
  expect(result.version).toBe("22.11.0");
  expect(result.npm).toBe("10.9.0");
  expect(result.date).toBe("2024-11-15");
 });
});

describe("NodeRelease", () => {
 const makeRef = () =>
  Effect.runSync(Ref.make(NodeSchedule.fromData(scheduleData)));

 it("creates from valid input", () => {
  const ref = makeRef();
  const release = Effect.runSync(
   NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
  );
  expect(release._tag).toBe("NodeRelease");
  expect(release.version.major).toBe(22);
  expect(release.version.minor).toBe(11);
  expect(release.npm.major).toBe(10);
 });

 it("fails on invalid version string", () => {
  const ref = makeRef();
  const result = Effect.runSyncExit(
   NodeRelease.fromInput({ version: "not-valid", npm: "10.9.0", date: "2024-11-15" }, ref),
  );
  expect(result._tag).toBe("Failure");
 });

 it("computes phase from schedule ref", () => {
  const ref = makeRef();
  const release = Effect.runSync(
   NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
  );
  const phase = Effect.runSync(
   release.phase(DateTime.unsafeMake("2025-01-15")),
  );
  expect(phase).toBe("active-lts");
 });

 it("computes lts status", () => {
  const ref = makeRef();
  const release = Effect.runSync(
   NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
  );
  const isLts = Effect.runSync(
   release.lts(DateTime.unsafeMake("2025-01-15")),
  );
  expect(isLts).toBe(true);
 });

 it("phase reads updated schedule via Ref", () => {
  const ref = makeRef();
  const release = Effect.runSync(
   NodeRelease.fromInput({ version: "22.11.0", npm: "10.9.0", date: "2024-11-15" }, ref),
  );

  // Update schedule to make v22 end-of-life immediately
  Effect.runSync(
   Ref.set(ref, NodeSchedule.fromData({
    v22: {
     start: "2024-04-24",
     lts: "2024-10-29",
     maintenance: "2025-10-21",
     end: "2025-01-01",
     codename: "Jod",
    },
   })),
  );

  const phase = Effect.runSync(
   release.phase(DateTime.unsafeMake("2025-01-15")),
  );
  expect(phase).toBe("end-of-life");
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/schemas/node-release.test.ts`
Expected: FAIL — module `./node-release.js` not found

- [ ] **Step 3: Write NodeRelease implementation**

```typescript
// src/schemas/node-release.ts
import { DateTime, Effect, Ref, Schema } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { NodePhase } from "./common.js";
import type { NodeSchedule } from "./node-schedule.js";

/**
 * Lean input schema for NodeRelease construction.
 * This is the shape the defaults generator writes.
 */
export const NodeReleaseInput = Schema.Struct({
 version: Schema.String,
 npm: Schema.String,
 date: Schema.String,
});
export type NodeReleaseInput = typeof NodeReleaseInput.Type;

/**
 * A Node.js release with parsed SemVer version and DateTime date.
 *
 * Plain class (not Data.TaggedClass) because it holds a Ref<NodeSchedule>
 * which would break structural equality semantics. Uses manual _tag field.
 */
export class NodeRelease {
 readonly _tag = "NodeRelease" as const;

 constructor(
  readonly version: SemVer.SemVer,
  readonly npm: SemVer.SemVer,
  readonly date: DateTime.DateTime,
  readonly scheduleRef: Ref.Ref<NodeSchedule>,
 ) {}

 /**
  * Determine this release's lifecycle phase at the given time.
  * Reads from the shared schedule Ref.
  */
 phase(now?: DateTime.DateTime): Effect.Effect<NodePhase | null> {
  const effectiveNow = now ?? DateTime.unsafeMake(new Date());
  return Effect.gen(this, function* () {
   const schedule = yield* Ref.get(this.scheduleRef);
   return yield* schedule.phaseFor(this.version.major, effectiveNow);
  });
 }

 /**
  * Whether this release is currently LTS (active-lts or maintenance-lts).
  */
 lts(now?: DateTime.DateTime): Effect.Effect<boolean> {
  return this.phase(now).pipe(
   Effect.map((p) => p === "active-lts" || p === "maintenance-lts"),
  );
 }

 /**
  * Create a NodeRelease from lean input strings.
  * Parses version/npm via SemVer.fromString, date via DateTime.
  */
 static fromInput(
  input: NodeReleaseInput,
  scheduleRef: Ref.Ref<NodeSchedule>,
 ): Effect.Effect<NodeRelease, InvalidVersionError> {
  return Effect.gen(function* () {
   const version = yield* SemVer.fromString(input.version);
   const npm = yield* SemVer.fromString(input.npm);
   const date = DateTime.unsafeMake(input.date);
   return new NodeRelease(version, npm, date, scheduleRef);
  });
 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/schemas/node-release.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Clean up node.ts — remove pseudo-code NodeRelease**

Remove `NodeReleaseBase` and `NodeRelease` class from `src/schemas/node.ts` (lines 5-30), keeping the `NodeDistVersion`, `NodeDistIndex`, `ReleaseScheduleEntry`, and `NodeReleaseSchedule` schemas. Remove the `Data`, `SemVer`, and `DateTime` type imports that are no longer used.

Also check `src/index.ts` — if `NodeRelease` or `NodeReleaseBase` are re-exported from there, remove those exports. Currently nothing imports `NodeRelease` from `node.ts`, but verify before deleting.

After edit, `src/schemas/node.ts` should contain only:

```typescript
import { Schema } from "effect";

export const NodeDistVersion = Schema.Struct({
 version: Schema.String,
 date: Schema.String,
 files: Schema.Array(Schema.String),
 npm: Schema.optional(Schema.String),
 v8: Schema.optional(Schema.String),
 uv: Schema.optional(Schema.String),
 zlib: Schema.optional(Schema.String),
 openssl: Schema.optional(Schema.String),
 modules: Schema.optional(Schema.String),
 lts: Schema.Union(Schema.Literal(false), Schema.String),
 security: Schema.Boolean,
});
export type NodeDistVersion = typeof NodeDistVersion.Type;

export const NodeDistIndex = Schema.Array(NodeDistVersion);
export type NodeDistIndex = typeof NodeDistIndex.Type;

export const ReleaseScheduleEntry = Schema.Struct({
 start: Schema.String,
 lts: Schema.optional(Schema.String),
 maintenance: Schema.optional(Schema.String),
 end: Schema.String,
 codename: Schema.optional(Schema.String),
});
export type ReleaseScheduleEntry = typeof ReleaseScheduleEntry.Type;

export const NodeReleaseSchedule = Schema.Record({
 key: Schema.String,
 value: ReleaseScheduleEntry,
});
export type NodeReleaseSchedule = typeof NodeReleaseSchedule.Type;
```

- [ ] **Step 6: Run full test suite to verify nothing broke**

Run: `pnpm vitest run`
Expected: All 205+ tests pass

- [ ] **Step 7: Commit**

```bash
git add src/schemas/node-release.ts src/schemas/node-release.test.ts src/schemas/node.ts
git commit -m "feat: add NodeRelease class with effectful phase/lts from schedule Ref

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 4: BunRelease and DenoRelease Classes

**Files:**

- Create: `src/schemas/bun-release.ts`
- Create: `src/schemas/deno-release.ts`
- Test: `src/schemas/bun-release.test.ts`
- Test: `src/schemas/deno-release.test.ts`

**Context:** Both are `Data.TaggedClass` instances with `version: SemVer.SemVer` and `date: DateTime.DateTime`. They use `RuntimeReleaseInput` for construction. Static `fromInput` factory parses strings.

- [ ] **Step 1: Write BunRelease failing test**

```typescript
// src/schemas/bun-release.test.ts
import { Effect, Equal } from "effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "./bun-release.js";

describe("BunRelease", () => {
 it("creates from valid input", () => {
  const release = Effect.runSync(
   BunRelease.fromInput({ version: "1.2.3", date: "2025-01-15" }),
  );
  expect(release._tag).toBe("BunRelease");
  expect(release.version.major).toBe(1);
  expect(release.version.minor).toBe(2);
  expect(release.version.patch).toBe(3);
 });

 it("fails on invalid version", () => {
  const result = Effect.runSyncExit(
   BunRelease.fromInput({ version: "bad", date: "2025-01-15" }),
  );
  expect(result._tag).toBe("Failure");
 });

 it("has structural equality via Data.TaggedClass", () => {
  const a = Effect.runSync(BunRelease.fromInput({ version: "1.0.0", date: "2025-01-01" }));
  const b = Effect.runSync(BunRelease.fromInput({ version: "1.0.0", date: "2025-01-01" }));
  expect(Equal.equals(a, b)).toBe(true);
 });
});
```

- [ ] **Step 2: Write DenoRelease failing test**

```typescript
// src/schemas/deno-release.test.ts
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { DenoRelease } from "./deno-release.js";

describe("DenoRelease", () => {
 it("creates from valid input", () => {
  const release = Effect.runSync(
   DenoRelease.fromInput({ version: "2.7.3", date: "2025-03-01" }),
  );
  expect(release._tag).toBe("DenoRelease");
  expect(release.version.major).toBe(2);
 });

 it("fails on invalid version", () => {
  const result = Effect.runSyncExit(
   DenoRelease.fromInput({ version: "xyz", date: "2025-01-01" }),
  );
  expect(result._tag).toBe("Failure");
 });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/schemas/bun-release.test.ts src/schemas/deno-release.test.ts`
Expected: FAIL — modules not found

- [ ] **Step 4: Write BunRelease implementation**

```typescript
// src/schemas/bun-release.ts
import { Data, DateTime, Effect } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "./runtime-release.js";

const BunReleaseBase = Data.TaggedClass("BunRelease");

/**
 * A Bun release with parsed SemVer version and DateTime date.
 */
export class BunRelease extends BunReleaseBase<{
 readonly version: SemVer.SemVer;
 readonly date: DateTime.DateTime;
}> {
 /**
  * Create a BunRelease from lean input strings.
  */
 static fromInput(
  input: RuntimeReleaseInput,
 ): Effect.Effect<BunRelease, InvalidVersionError> {
  return Effect.gen(function* () {
   const version = yield* SemVer.fromString(input.version);
   // Fall back to current time if published_at is null (rare).
   const date = input.date
    ? DateTime.unsafeMake(input.date)
    : DateTime.unsafeMake(new Date());
   return new BunRelease({ version, date });
  });
 }
}
```

- [ ] **Step 5: Write DenoRelease implementation**

```typescript
// src/schemas/deno-release.ts
import { Data, DateTime, Effect } from "effect";
import type { InvalidVersionError } from "semver-effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "./runtime-release.js";

const DenoReleaseBase = Data.TaggedClass("DenoRelease");

/**
 * A Deno release with parsed SemVer version and DateTime date.
 */
export class DenoRelease extends DenoReleaseBase<{
 readonly version: SemVer.SemVer;
 readonly date: DateTime.DateTime;
}> {
 /**
  * Create a DenoRelease from lean input strings.
  */
 static fromInput(
  input: RuntimeReleaseInput,
 ): Effect.Effect<DenoRelease, InvalidVersionError> {
  return Effect.gen(function* () {
   const version = yield* SemVer.fromString(input.version);
   // Fall back to current time if published_at is null (rare).
   const date = input.date
    ? DateTime.unsafeMake(input.date)
    : DateTime.unsafeMake(new Date());
   return new DenoRelease({ version, date });
  });
 }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/schemas/bun-release.test.ts src/schemas/deno-release.test.ts`
Expected: PASS (5 tests total)

- [ ] **Step 7: Commit**

```bash
git add src/schemas/bun-release.ts src/schemas/bun-release.test.ts src/schemas/deno-release.ts src/schemas/deno-release.test.ts
git commit -m "feat: add BunRelease and DenoRelease domain classes

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 2: Cache Layer (Phase 2)

### Task 5: RuntimeCache Service Interface

**Files:**

- Create: `src/services/RuntimeCache.ts`
- Test: `src/services/RuntimeCache.test.ts`

**Context:** Generic Effect service wrapping semver-effect's `VersionCache`. Holds a `Map<string, R>` for release lookup alongside the inner `VersionCache` for version math. The interface is runtime-agnostic; Node/Bun/Deno each get a concrete tag.

- [ ] **Step 1: Write the service interface**

```typescript
// src/services/RuntimeCache.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { EmptyCacheError, UnsatisfiedRangeError } from "semver-effect";
import type { RuntimeRelease } from "../schemas/runtime-release.js";

/**
 * Generic cache service wrapping semver-effect's VersionCache
 * with typed release lookup.
 */
export interface RuntimeCache<R extends RuntimeRelease> {
 readonly load: (releases: ReadonlyArray<R>) => Effect.Effect<void>;
 readonly resolve: (range: string) => Effect.Effect<R, UnsatisfiedRangeError>;
 readonly releases: () => Effect.Effect<ReadonlyArray<R>>;
 readonly filter: (range: string) => Effect.Effect<ReadonlyArray<R>>;
 readonly latest: () => Effect.Effect<R, EmptyCacheError>;
 readonly latestByMajor: () => Effect.Effect<ReadonlyArray<R>>;
 readonly latestByMinor: () => Effect.Effect<ReadonlyArray<R>>;
}
```

Note: No `Context.GenericTag` here — each runtime defines its own tag. This file is interface-only.

- [ ] **Step 2: Commit**

```bash
git add src/services/RuntimeCache.ts
git commit -m "feat: add RuntimeCache generic service interface

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 6: NodeReleaseCache Service Interface

**Files:**

- Create: `src/services/NodeReleaseCache.ts`

**Context:** Extends `RuntimeCache<NodeRelease>` with Node-specific schedule methods. This is the service tag that NodeResolverLive will depend on.

- [ ] **Step 1: Write the service interface**

```typescript
// src/services/NodeReleaseCache.ts
import type { DateTime, Effect } from "effect";
import { Context } from "effect";
import type { EmptyCacheError, UnsatisfiedRangeError } from "semver-effect";
import type { NodeRelease, NodeReleaseInput } from "../schemas/node-release.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import type { RuntimeCache } from "./RuntimeCache.js";

/**
 * Node-specific cache extending RuntimeCache with schedule operations.
 */
export interface NodeReleaseCache extends RuntimeCache<NodeRelease> {
 readonly updateSchedule: (data: NodeScheduleData) => Effect.Effect<void>;
 readonly loadFromInputs: (inputs: ReadonlyArray<NodeReleaseInput>) => Effect.Effect<void>;
 readonly ltsReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;
 readonly currentReleases: (now?: DateTime.DateTime) => Effect.Effect<ReadonlyArray<NodeRelease>>;
}

/**
 * @internal Uses GenericTag — see BunResolver.ts for rationale.
 */
export const NodeReleaseCache = Context.GenericTag<NodeReleaseCache>("NodeReleaseCache");
```

- [ ] **Step 2: Commit**

```bash
git add src/services/NodeReleaseCache.ts
git commit -m "feat: add NodeReleaseCache service interface

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 7: RuntimeCacheLive Generic Implementation

**Files:**

- Create: `src/layers/RuntimeCacheLive.ts`
- Test: `src/layers/RuntimeCacheLive.test.ts`

**Context:** The generic implementation that wraps semver-effect's `VersionCache`. Extracts `SemVer` versions from releases, loads them into the inner cache, and maintains a `Map<string, R>` for typed lookup. Depends on `SemVerParserLive` and `VersionCacheLive` from semver-effect.

- [ ] **Step 1: Write the failing test**

```typescript
// src/layers/RuntimeCacheLive.test.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCache as SemVerVersionCache, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "../schemas/bun-release.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);

const makeBunReleases = () =>
 Effect.all([
  BunRelease.fromInput({ version: "1.2.3", date: "2025-01-15" }),
  BunRelease.fromInput({ version: "1.1.0", date: "2025-01-01" }),
  BunRelease.fromInput({ version: "1.3.0", date: "2025-02-01" }),
  BunRelease.fromInput({ version: "0.9.0", date: "2024-12-01" }),
 ]);

describe("RuntimeCacheLive", () => {
 it("loads releases and returns them", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const all = yield* cache.releases();
   expect(all.length).toBe(4);
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });

 it("resolves range to best match", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const result = yield* cache.resolve("^1.0.0");
   expect(result.version.toString()).toBe("1.3.0");
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });

 it("filters by range", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const filtered = yield* cache.filter("^1.0.0");
   expect(filtered.length).toBe(3);
   expect(filtered.every((r) => r.version.major === 1)).toBe(true);
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });

 it("returns latest", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const latest = yield* cache.latest();
   expect(latest.version.toString()).toBe("1.3.0");
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });

 it("returns latestByMajor", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const byMajor = yield* cache.latestByMajor();
   expect(byMajor.length).toBe(2); // major 0 and major 1
   const versions = byMajor.map((r) => r.version.toString());
   expect(versions).toContain("1.3.0");
   expect(versions).toContain("0.9.0");
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });

 it("returns latestByMinor", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* createRuntimeCache<BunRelease>();
   const releases = yield* makeBunReleases();
   yield* cache.load(releases);
   const byMinor = yield* cache.latestByMinor();
   // 0.9, 1.1, 1.2, 1.3 — each has one version
   expect(byMinor.length).toBe(4);
  });
  await Effect.runPromise(program.pipe(Effect.provide(SemVerLayer)));
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/layers/RuntimeCacheLive.test.ts`
Expected: FAIL — module `./RuntimeCacheLive.js` not found or `createRuntimeCache` not exported

- [ ] **Step 3: Write RuntimeCacheLive implementation**

```typescript
// src/layers/RuntimeCacheLive.ts
import { Effect } from "effect";
import {
 Range,
 SemVer,
 VersionCache as SemVerVersionCache,
} from "semver-effect";
import type { RuntimeRelease } from "../schemas/runtime-release.js";
import type { RuntimeCache } from "../services/RuntimeCache.js";

/**
 * Creates a RuntimeCache<R> backed by semver-effect's VersionCache.
 * Must be called within an Effect that has SemVerVersionCache provided.
 */
export const createRuntimeCache = <R extends RuntimeRelease>(): Effect.Effect<
 RuntimeCache<R>,
 never,
 SemVerVersionCache
> =>
 Effect.gen(function* () {
  const innerCache = yield* SemVerVersionCache;
  const lookupMap = new Map<string, R>();

  return {
   load: (releases: ReadonlyArray<R>) =>
    Effect.gen(function* () {
     lookupMap.clear();
     const versions: SemVer.SemVer[] = [];
     for (const r of releases) {
      const key = r.version.toString();
      lookupMap.set(key, r);
      versions.push(r.version);
     }
     yield* innerCache.load(versions);
    }),

   resolve: (range: string) =>
    Effect.gen(function* () {
     const parsed = yield* Range.fromString(range);
     const resolved = yield* innerCache.resolve(parsed);
     const release = lookupMap.get(resolved.toString());
     if (!release) {
      // Should not happen if load was called correctly
      return yield* Effect.die(
       new Error(`Cache inconsistency: ${resolved.toString()} not in lookup map`),
      );
     }
     return release;
    }),

   releases: () =>
    Effect.gen(function* () {
     const versions = yield* innerCache.versions.pipe(
      Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)),
     );
     return versions
      .map((v) => lookupMap.get(v.toString()))
      .filter((r): r is R => r !== undefined);
    }),

   filter: (range: string) =>
    Effect.gen(function* () {
     const parsed = yield* Range.fromString(range);
     const filtered = yield* innerCache.filter(parsed).pipe(
      Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)),
     );
     return filtered
      .map((v) => lookupMap.get(v.toString()))
      .filter((r): r is R => r !== undefined);
    }),

   latest: () =>
    Effect.gen(function* () {
     const version = yield* innerCache.latest();
     const release = lookupMap.get(version.toString());
     if (!release) {
      return yield* Effect.die(
       new Error(`Cache inconsistency: ${version.toString()} not in lookup map`),
      );
     }
     return release;
    }),

   latestByMajor: () =>
    Effect.gen(function* () {
     const versions = yield* innerCache.latestByMajor().pipe(
      Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)),
     );
     return versions
      .map((v) => lookupMap.get(v.toString()))
      .filter((r): r is R => r !== undefined);
    }),

   latestByMinor: () =>
    Effect.gen(function* () {
     const versions = yield* innerCache.latestByMinor().pipe(
      Effect.catchTag("EmptyCacheError", () => Effect.succeed([] as ReadonlyArray<SemVer.SemVer>)),
     );
     return versions
      .map((v) => lookupMap.get(v.toString()))
      .filter((r): r is R => r !== undefined);
    }),
  };
 });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/layers/RuntimeCacheLive.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/layers/RuntimeCacheLive.ts src/layers/RuntimeCacheLive.test.ts
git commit -m "feat: add RuntimeCacheLive generic cache implementation

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 8: NodeReleaseCacheLive

**Files:**

- Create: `src/layers/NodeReleaseCacheLive.ts`
- Test: `src/layers/NodeReleaseCacheLive.test.ts`

**Context:** Node-specific cache Layer that wraps `RuntimeCacheLive` and adds the `Ref<NodeSchedule>`. Creates the Ref in its Layer body. Provides `updateSchedule`, `ltsReleases`, and `currentReleases`.

- [ ] **Step 1: Write the failing test**

```typescript
// src/layers/NodeReleaseCacheLive.test.ts
import { DateTime, Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const scheduleData: NodeScheduleData = {
 v22: {
  start: "2024-04-24",
  lts: "2024-10-29",
  maintenance: "2025-10-21",
  end: "2027-04-30",
  codename: "Jod",
 },
 v24: {
  start: "2025-04-22",
  lts: "2025-10-28",
  maintenance: "2026-10-20",
  end: "2028-04-30",
 },
};

const nodeInputs = [
 { version: "24.0.0", npm: "11.0.0", date: "2025-04-22" },
 { version: "22.11.0", npm: "10.9.0", date: "2024-11-15" },
 { version: "22.10.0", npm: "10.8.0", date: "2024-10-01" },
];

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const TestLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

describe("NodeReleaseCacheLive", () => {
 it("loads from inputs and returns releases", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* NodeReleaseCache;
   yield* cache.updateSchedule(scheduleData);
   yield* cache.loadFromInputs(nodeInputs);
   const all = yield* cache.releases();
   expect(all.length).toBe(3);
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });

 it("returns LTS releases", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* NodeReleaseCache;
   yield* cache.updateSchedule(scheduleData);
   yield* cache.loadFromInputs(nodeInputs);
   const lts = yield* cache.ltsReleases(DateTime.unsafeMake("2025-01-15"));
   // v22 should be active-lts at this point
   expect(lts.length).toBeGreaterThan(0);
   for (const r of lts) {
    expect(r.version.major).toBe(22);
   }
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });

 it("returns current releases", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* NodeReleaseCache;
   yield* cache.updateSchedule(scheduleData);
   yield* cache.loadFromInputs(nodeInputs);
   const current = yield* cache.currentReleases(DateTime.unsafeMake("2025-06-01"));
   // v24 should be "current" at this point
   expect(current.length).toBeGreaterThan(0);
   for (const r of current) {
    expect(r.version.major).toBe(24);
   }
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/layers/NodeReleaseCacheLive.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write NodeReleaseCacheLive implementation**

The Layer body should:

1. Create `Ref<NodeSchedule>` with an empty initial schedule
2. Create the inner `RuntimeCache<NodeRelease>` via `createRuntimeCache`
3. Return a `NodeReleaseCache` implementation that:
   - Delegates all `RuntimeCache` methods to the inner cache
   - `updateSchedule` sets the Ref and re-creates releases if needed
   - `ltsReleases` filters releases where `phase` is active-lts or maintenance-lts
   - `currentReleases` filters where `phase` is "current"

```typescript
// src/layers/NodeReleaseCacheLive.ts
import { DateTime, Effect, Layer, Ref } from "effect";
import { VersionCache as SemVerVersionCache } from "semver-effect";
import { NodeRelease } from "../schemas/node-release.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";
import { NodeSchedule } from "../schemas/node-schedule.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

export const NodeReleaseCacheLive: Layer.Layer<
 NodeReleaseCache,
 never,
 SemVerVersionCache
> = Layer.effect(
 NodeReleaseCache,
 Effect.gen(function* () {
  const scheduleRef = yield* Ref.make(NodeSchedule.fromData({}));
  const inner = yield* createRuntimeCache<NodeRelease>();

  // Held separately so we can rebuild releases when schedule updates
  let currentInputs: ReadonlyArray<NodeReleaseInput> = [];

  const buildAndLoad = (inputs: ReadonlyArray<NodeReleaseInput>) =>
   Effect.gen(function* () {
    const releases: NodeRelease[] = [];
    for (const input of inputs) {
     const release = yield* NodeRelease.fromInput(input, scheduleRef).pipe(
      Effect.catchAll(() => Effect.succeed(null)),
     );
     if (release) releases.push(release);
    }
    yield* inner.load(releases);
   });

  return {
   // -- RuntimeCache<NodeRelease> delegation --
   load: (releases) => inner.load(releases),
   resolve: (range) => inner.resolve(range),
   releases: () => inner.releases(),
   filter: (range) => inner.filter(range),
   latest: () => inner.latest(),
   latestByMajor: () => inner.latestByMajor(),
   latestByMinor: () => inner.latestByMinor(),

   // -- Node-specific --
   updateSchedule: (data: NodeScheduleData) =>
    Effect.gen(function* () {
     yield* Ref.set(scheduleRef, NodeSchedule.fromData(data));
     // Rebuild releases if we have stored inputs
     if (currentInputs.length > 0) {
      yield* buildAndLoad(currentInputs);
     }
    }),

   /**
    * Load from lean inputs (used by freshness layers).
    * This creates NodeRelease instances using the internal schedule Ref.
    */
   loadFromInputs: (inputs: ReadonlyArray<NodeReleaseInput>) =>
    Effect.gen(function* () {
     currentInputs = inputs;
     yield* buildAndLoad(inputs);
    }),

   ltsReleases: (now?: DateTime.DateTime) =>
    Effect.gen(function* () {
     const all = yield* inner.releases();
     const results: NodeRelease[] = [];
     for (const r of all) {
      const phase = yield* r.phase(now);
      if (phase === "active-lts" || phase === "maintenance-lts") {
       results.push(r);
      }
     }
     return results;
    }),

   currentReleases: (now?: DateTime.DateTime) =>
    Effect.gen(function* () {
     const all = yield* inner.releases();
     const results: NodeRelease[] = [];
     for (const r of all) {
      const phase = yield* r.phase(now);
      if (phase === "current") {
       results.push(r);
      }
     }
     return results;
    }),
  };
 }),
);
```

- [ ] **Step 4: Adapt and finalize test, run to verify it passes**

The implementer should update the test to use the actual `loadFromInputs` and `updateSchedule` methods. Expected: PASS.

Run: `pnpm vitest run src/layers/NodeReleaseCacheLive.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/layers/NodeReleaseCacheLive.ts src/layers/NodeReleaseCacheLive.test.ts
git commit -m "feat: add NodeReleaseCacheLive with schedule Ref and phase-aware queries

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 9: BunReleaseCache and DenoReleaseCache

**Files:**

- Create: `src/services/BunReleaseCache.ts`
- Create: `src/services/DenoReleaseCache.ts`
- Create: `src/layers/BunReleaseCacheLive.ts`
- Create: `src/layers/DenoReleaseCacheLive.ts`
- Test: `src/layers/BunReleaseCacheLive.test.ts`

**Context:** Plain `RuntimeCache<BunRelease>` / `RuntimeCache<DenoRelease>` — no extra methods. Each gets a `Context.GenericTag` and a simple Layer that creates a `RuntimeCache` instance.

- [ ] **Step 1: Write service interfaces**

```typescript
// src/services/BunReleaseCache.ts
import { Context } from "effect";
import type { BunRelease } from "../schemas/bun-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

export type BunReleaseCache = RuntimeCache<BunRelease>;
export const BunReleaseCache = Context.GenericTag<BunReleaseCache>("BunReleaseCache");
```

```typescript
// src/services/DenoReleaseCache.ts
import { Context } from "effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import type { RuntimeCache } from "./RuntimeCache.js";

export type DenoReleaseCache = RuntimeCache<DenoRelease>;
export const DenoReleaseCache = Context.GenericTag<DenoReleaseCache>("DenoReleaseCache");
```

- [ ] **Step 2: Write Layer implementations**

```typescript
// src/layers/BunReleaseCacheLive.ts
import { Layer } from "effect";
import { VersionCache as SemVerVersionCache } from "semver-effect";
import type { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

export const BunReleaseCacheLive: Layer.Layer<
 BunReleaseCache,
 never,
 SemVerVersionCache
> = Layer.effect(
 BunReleaseCache,
 createRuntimeCache<BunRelease>(),
);
```

```typescript
// src/layers/DenoReleaseCacheLive.ts
import { Layer } from "effect";
import { VersionCache as SemVerVersionCache } from "semver-effect";
import type { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { createRuntimeCache } from "./RuntimeCacheLive.js";

export const DenoReleaseCacheLive: Layer.Layer<
 DenoReleaseCache,
 never,
 SemVerVersionCache
> = Layer.effect(
 DenoReleaseCache,
 createRuntimeCache<DenoRelease>(),
);
```

- [ ] **Step 3: Write BunReleaseCacheLive test**

```typescript
// src/layers/BunReleaseCacheLive.test.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { describe, expect, it } from "vitest";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const TestLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

describe("BunReleaseCacheLive", () => {
 it("loads and queries releases", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* BunReleaseCache;
   const releases = yield* Effect.all([
    BunRelease.fromInput({ version: "1.2.0", date: "2025-01-01" }),
    BunRelease.fromInput({ version: "1.3.0", date: "2025-02-01" }),
   ]);
   yield* cache.load(releases);
   const latest = yield* cache.latest();
   expect(latest.version.toString()).toBe("1.3.0");
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm vitest run src/layers/BunReleaseCacheLive.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/BunReleaseCache.ts src/services/DenoReleaseCache.ts src/layers/BunReleaseCacheLive.ts src/layers/DenoReleaseCacheLive.ts src/layers/BunReleaseCacheLive.test.ts
git commit -m "feat: add BunReleaseCache and DenoReleaseCache with Live layers

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 3: Fetchers (Phase 3)

### Task 10: NodeVersionFetcher Service and Implementation

**Files:**

- Create: `src/services/NodeVersionFetcher.ts`
- Create: `src/layers/NodeVersionFetcherLive.ts`
- Test: `src/layers/NodeVersionFetcherLive.test.ts`

**Context:** Fetches `https://nodejs.org/dist/index.json`, decodes via `NodeDistIndex` schema, strips `v` prefix, parses to `SemVer`, and extracts lean `NodeReleaseInput`. Returns both `versions` (for inner cache) and `inputs` (for release construction).

- [ ] **Step 1: Write service interface**

```typescript
// src/services/NodeVersionFetcher.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";

export interface NodeVersionFetcher {
 readonly fetch: () => Effect.Effect<
  {
   readonly versions: ReadonlyArray<SemVer.SemVer>;
   readonly inputs: ReadonlyArray<NodeReleaseInput>;
  },
  NetworkError | ParseError
 >;
}

export const NodeVersionFetcher = Context.GenericTag<NodeVersionFetcher>("NodeVersionFetcher");
```

- [ ] **Step 2: Write implementation**

```typescript
// src/layers/NodeVersionFetcherLive.ts
import { Effect, Layer, Option, Schema } from "effect";
import { SemVer } from "semver-effect";
import { ParseError } from "../errors/ParseError.js";
import type { NodeReleaseInput } from "../schemas/node-release.js";
import { NodeDistIndex } from "../schemas/node.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";

const NODE_DIST_URL = "https://nodejs.org/dist/index.json";

const decodeDistIndex = (input: unknown) =>
 Schema.decodeUnknown(NodeDistIndex)(input).pipe(
  Effect.mapError(
   (e) =>
    new ParseError({
     source: NODE_DIST_URL,
     message: `Schema validation failed: ${e.message}`,
    }),
  ),
 );

export const NodeVersionFetcherLive: Layer.Layer<
 NodeVersionFetcher,
 never,
 GitHubClient
> = Layer.effect(
 NodeVersionFetcher,
 Effect.gen(function* () {
  const client = yield* GitHubClient;

  return {
   fetch: () =>
    Effect.gen(function* () {
     const allVersions = yield* client.getJson(NODE_DIST_URL, {
      decode: decodeDistIndex,
     });

     const versions: SemVer.SemVer[] = [];
     const inputs: NodeReleaseInput[] = [];

     for (const entry of allVersions) {
      const clean = entry.version.replace(/^v/, "");
      const parsed = Effect.runSync(
       SemVer.fromString(clean).pipe(
        Effect.map(Option.some),
        Effect.orElseSucceed(() => Option.none()),
       ),
      );
      if (Option.isSome(parsed)) {
       versions.push(parsed.value);
       inputs.push({
        version: clean,
        npm: entry.npm ?? "0.0.0",
        date: entry.date,
       });
      }
     }

     return { versions, inputs };
    }),
  };
 }),
);
```

- [ ] **Step 3: Write test with mock GitHubClient**

```typescript
// src/layers/NodeVersionFetcherLive.test.ts
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { NetworkError } from "../errors/NetworkError.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeVersionFetcherLive } from "./NodeVersionFetcherLive.js";

const mockVersions = [
 { version: "v22.11.0", date: "2024-11-15", files: [], npm: "10.9.0", lts: "Jod", security: false },
 { version: "v22.10.0", date: "2024-10-01", files: [], lts: false, security: false },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
 listTags: () => Effect.succeed([]),
 listReleases: () => Effect.succeed([]),
 getJson: (_url, schema) => schema.decode(mockVersions),
});

const TestLayer = NodeVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("NodeVersionFetcherLive", () => {
 it("fetches and parses node versions", async () => {
  const program = Effect.gen(function* () {
   const fetcher = yield* NodeVersionFetcher;
   const { versions, inputs } = yield* fetcher.fetch();
   expect(versions.length).toBe(2);
   expect(inputs.length).toBe(2);
   expect(inputs[0].version).toBe("22.11.0");
   expect(inputs[0].npm).toBe("10.9.0");
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

- [ ] **Step 4: Run test**

Run: `pnpm vitest run src/layers/NodeVersionFetcherLive.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/NodeVersionFetcher.ts src/layers/NodeVersionFetcherLive.ts src/layers/NodeVersionFetcherLive.test.ts
git commit -m "feat: add NodeVersionFetcher service and Live implementation

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 11: NodeScheduleFetcher Service and Implementation

**Files:**

- Create: `src/services/NodeScheduleFetcher.ts`
- Create: `src/layers/NodeScheduleFetcherLive.ts`
- Test: `src/layers/NodeScheduleFetcherLive.test.ts`

**Context:** Separate service that fetches `schedule.json` from the Node.js Release repo. Returns `NodeScheduleData`.

- [ ] **Step 1: Write service interface**

```typescript
// src/services/NodeScheduleFetcher.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { NodeScheduleData } from "../schemas/node-schedule.js";

export interface NodeScheduleFetcher {
 readonly fetch: () => Effect.Effect<NodeScheduleData, NetworkError | ParseError>;
}

export const NodeScheduleFetcher = Context.GenericTag<NodeScheduleFetcher>("NodeScheduleFetcher");
```

- [ ] **Step 2: Write implementation**

```typescript
// src/layers/NodeScheduleFetcherLive.ts
import { Effect, Layer, Schema } from "effect";
import { ParseError } from "../errors/ParseError.js";
import { NodeReleaseSchedule } from "../schemas/node.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";

const NODE_SCHEDULE_URL =
 "https://raw.githubusercontent.com/nodejs/Release/refs/heads/main/schedule.json";

const decodeSchedule = (input: unknown) =>
 Schema.decodeUnknown(NodeReleaseSchedule)(input).pipe(
  Effect.mapError(
   (e) =>
    new ParseError({
     source: NODE_SCHEDULE_URL,
     message: `Schema validation failed: ${e.message}`,
    }),
  ),
 );

export const NodeScheduleFetcherLive: Layer.Layer<
 NodeScheduleFetcher,
 never,
 GitHubClient
> = Layer.effect(
 NodeScheduleFetcher,
 Effect.gen(function* () {
  const client = yield* GitHubClient;
  return {
   fetch: () => client.getJson(NODE_SCHEDULE_URL, { decode: decodeSchedule }),
  };
 }),
);
```

- [ ] **Step 3: Write test, run, verify pass**

```typescript
// src/layers/NodeScheduleFetcherLive.test.ts
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeScheduleFetcherLive } from "./NodeScheduleFetcherLive.js";

const mockSchedule = {
 v22: { start: "2024-04-24", lts: "2024-10-29", end: "2027-04-30", codename: "Jod" },
};

const MockGitHubClient = Layer.succeed(GitHubClient, {
 listTags: () => Effect.succeed([]),
 listReleases: () => Effect.succeed([]),
 getJson: (_url, schema) => schema.decode(mockSchedule),
});

const TestLayer = NodeScheduleFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("NodeScheduleFetcherLive", () => {
 it("fetches and returns schedule data", async () => {
  const program = Effect.gen(function* () {
   const fetcher = yield* NodeScheduleFetcher;
   const data = yield* fetcher.fetch();
   expect(data.v22).toBeDefined();
   expect(data.v22.codename).toBe("Jod");
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

Run: `pnpm vitest run src/layers/NodeScheduleFetcherLive.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/services/NodeScheduleFetcher.ts src/layers/NodeScheduleFetcherLive.ts src/layers/NodeScheduleFetcherLive.test.ts
git commit -m "feat: add NodeScheduleFetcher service and Live implementation

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 12: BunVersionFetcher and DenoVersionFetcher

**Files:**

- Create: `src/services/BunVersionFetcher.ts`
- Create: `src/services/DenoVersionFetcher.ts`
- Create: `src/layers/BunVersionFetcherLive.ts`
- Create: `src/layers/DenoVersionFetcherLive.ts`
- Test: `src/layers/BunVersionFetcherLive.test.ts`
- Test: `src/layers/DenoVersionFetcherLive.test.ts`

**Context:** Same pattern as Node — custom interface returning both `versions` and `inputs`. Bun strips `bun-` prefix and `v` prefix. Deno strips `v` prefix only. Tags that fail parsing are silently skipped.

- [ ] **Step 1: Write service interfaces**

```typescript
// src/services/BunVersionFetcher.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";

export interface BunVersionFetcher {
 readonly fetch: () => Effect.Effect<
  {
   readonly versions: ReadonlyArray<SemVer.SemVer>;
   readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
  },
  NetworkError | ParseError
 >;
}

export const BunVersionFetcher = Context.GenericTag<BunVersionFetcher>("BunVersionFetcher");
```

```typescript
// src/services/DenoVersionFetcher.ts
import type { Effect } from "effect";
import { Context } from "effect";
import type { SemVer } from "semver-effect";
import type { NetworkError } from "../errors/NetworkError.js";
import type { ParseError } from "../errors/ParseError.js";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";

export interface DenoVersionFetcher {
 readonly fetch: () => Effect.Effect<
  {
   readonly versions: ReadonlyArray<SemVer.SemVer>;
   readonly inputs: ReadonlyArray<RuntimeReleaseInput>;
  },
  NetworkError | ParseError
 >;
}

export const DenoVersionFetcher = Context.GenericTag<DenoVersionFetcher>("DenoVersionFetcher");
```

- [ ] **Step 2: Write BunVersionFetcherLive**

Uses `listReleases` instead of `listTags` to get `published_at` dates for each release.

```typescript
// src/layers/BunVersionFetcherLive.ts
import { Effect, Layer, Option } from "effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { retryOnRateLimit } from "../lib/retry.js";

/**
 * Strip bun- prefix and v/V prefix, parse to SemVer.
 * Returns the parsed SemVer directly to avoid double parsing.
 */
function normalizeBunTag(tagName: string): Option.Option<SemVer.SemVer> {
 const version = tagName.startsWith("bun-") ? tagName.slice(4) : tagName;
 const stripped = version.startsWith("v") || version.startsWith("V") ? version.slice(1) : version;
 return Effect.runSync(
  SemVer.fromString(stripped).pipe(
   Effect.map(Option.some),
   Effect.orElseSucceed(() => Option.none()),
  ),
 );
}

export const BunVersionFetcherLive: Layer.Layer<
 BunVersionFetcher,
 never,
 GitHubClient
> = Layer.effect(
 BunVersionFetcher,
 Effect.gen(function* () {
  const client = yield* GitHubClient;

  return {
   fetch: () =>
    Effect.gen(function* () {
     const releases = yield* retryOnRateLimit(
      client.listReleases("oven-sh", "bun", { perPage: 100, pages: 3 }),
     );

     const versions: SemVer.SemVer[] = [];
     const inputs: RuntimeReleaseInput[] = [];

     for (const release of releases) {
      if (release.draft || release.prerelease) continue;
      const opt = normalizeBunTag(release.tag_name);
      if (Option.isNone(opt)) continue;
      versions.push(opt.value);
      inputs.push({
       version: opt.value.toString(),
       date: release.published_at ?? new Date().toISOString().slice(0, 10),
      });
     }

     return { versions, inputs };
    }),
  };
 }),
);
```

- [ ] **Step 3: Write DenoVersionFetcherLive (same pattern, uses releases for dates)**

```typescript
// src/layers/DenoVersionFetcherLive.ts
import { Effect, Layer, Option } from "effect";
import { SemVer } from "semver-effect";
import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";
import { GitHubClient } from "../services/GitHubClient.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { retryOnRateLimit } from "../lib/retry.js";

export const DenoVersionFetcherLive: Layer.Layer<
 DenoVersionFetcher,
 never,
 GitHubClient
> = Layer.effect(
 DenoVersionFetcher,
 Effect.gen(function* () {
  const client = yield* GitHubClient;

  return {
   fetch: () =>
    Effect.gen(function* () {
     const releases = yield* retryOnRateLimit(
      client.listReleases("denoland", "deno", { perPage: 100, pages: 3 }),
     );

     const versions: SemVer.SemVer[] = [];
     const inputs: RuntimeReleaseInput[] = [];

     for (const release of releases) {
      if (release.draft || release.prerelease) continue;
      const stripped = release.tag_name.startsWith("v")
       ? release.tag_name.slice(1)
       : release.tag_name;
      const opt = Effect.runSync(
       SemVer.fromString(stripped).pipe(
        Effect.map(Option.some),
        Effect.orElseSucceed(() => Option.none()),
       ),
      );
      if (Option.isSome(opt)) {
       versions.push(opt.value);
       inputs.push({
        version: stripped,
        date: release.published_at ?? new Date().toISOString().slice(0, 10),
       });
      }
     }

     return { versions, inputs };
    }),
  };
 }),
);
```

- [ ] **Step 4: Write tests for both**

```typescript
// src/layers/BunVersionFetcherLive.test.ts
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { BunVersionFetcherLive } from "./BunVersionFetcherLive.js";

const mockReleases = [
 { tag_name: "bun-v1.2.3", name: "Bun v1.2.3", draft: false, prerelease: false, published_at: "2025-01-15" },
 { tag_name: "v0.1.0", name: "v0.1.0", draft: false, prerelease: false, published_at: "2024-06-01" },
 { tag_name: "canary", name: "Canary", draft: false, prerelease: true, published_at: "2025-02-01" },
 { tag_name: "bun-v1.3.0-beta", name: "Beta", draft: true, prerelease: false, published_at: "2025-02-01" },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
 listTags: () => Effect.succeed([]),
 listReleases: () => Effect.succeed(mockReleases),
 getJson: () => Effect.succeed(undefined) as never,
});

const TestLayer = BunVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("BunVersionFetcherLive", () => {
 it("normalizes bun release tags, skips drafts/prereleases/invalid, and includes dates", async () => {
  const program = Effect.gen(function* () {
   const fetcher = yield* BunVersionFetcher;
   const { versions, inputs } = yield* fetcher.fetch();
   expect(versions.length).toBe(2);
   expect(inputs.length).toBe(2);
   expect(inputs[0].version).toBe("1.2.3");
   expect(inputs[0].date).toBe("2025-01-15");
   expect(inputs[1].version).toBe("0.1.0");
   expect(inputs[1].date).toBe("2024-06-01");
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

```typescript
// src/layers/DenoVersionFetcherLive.test.ts
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { GitHubClient } from "../services/GitHubClient.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { DenoVersionFetcherLive } from "./DenoVersionFetcherLive.js";

const mockReleases = [
 { tag_name: "v2.7.3", name: "Deno 2.7.3", draft: false, prerelease: false, published_at: "2025-03-01" },
 { tag_name: "v1.40.0", name: "Deno 1.40.0", draft: false, prerelease: false, published_at: "2024-01-15" },
 { tag_name: "latest", name: "Latest", draft: false, prerelease: false, published_at: "2025-03-10" },
];

const MockGitHubClient = Layer.succeed(GitHubClient, {
 listTags: () => Effect.succeed([]),
 listReleases: () => Effect.succeed(mockReleases),
 getJson: () => Effect.succeed(undefined) as never,
});

const TestLayer = DenoVersionFetcherLive.pipe(Layer.provide(MockGitHubClient));

describe("DenoVersionFetcherLive", () => {
 it("normalizes deno release tags, skips invalid, and includes dates", async () => {
  const program = Effect.gen(function* () {
   const fetcher = yield* DenoVersionFetcher;
   const { versions, inputs } = yield* fetcher.fetch();
   expect(versions.length).toBe(2);
   expect(inputs[0].version).toBe("2.7.3");
   expect(inputs[0].date).toBe("2025-03-01");
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/layers/BunVersionFetcherLive.test.ts src/layers/DenoVersionFetcherLive.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/services/BunVersionFetcher.ts src/services/DenoVersionFetcher.ts src/layers/BunVersionFetcherLive.ts src/layers/DenoVersionFetcherLive.ts src/layers/BunVersionFetcherLive.test.ts src/layers/DenoVersionFetcherLive.test.ts
git commit -m "feat: add Bun and Deno version fetcher services and implementations

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 13: Freshness Layer Variants — Node

**Files:**

- Create: `src/layers/AutoNodeCacheLive.ts`
- Create: `src/layers/FreshNodeCacheLive.ts`
- Create: `src/layers/OfflineNodeCacheLive.ts`
- Test: `src/layers/AutoNodeCacheLive.test.ts`

**Context:** Three Layer variants controlling how the `NodeReleaseCache` gets populated. `Auto` tries fetchers, falls back to defaults. `Fresh` requires fetchers. `Offline` uses defaults only. The cache itself is unaware of freshness.

- [ ] **Step 1: Write AutoNodeCacheLive**

```typescript
// src/layers/AutoNodeCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { nodeDefaultInputs, nodeDefaultSchedule } from "../data/node-defaults.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

/**
 * Auto freshness: try fetchers, fall back to defaults on NetworkError.
 * Composes NodeReleaseCacheLive (which provides the empty cache) with
 * a setup effect that populates it.
 */
const setup = Effect.gen(function* () {
 const cache = yield* NodeReleaseCache;
 const versionFetcher = yield* NodeVersionFetcher;
 const scheduleFetcher = yield* NodeScheduleFetcher;

 const { inputs, scheduleData } = yield* Effect.gen(function* () {
  const [fetchResult, schedule] = yield* Effect.all([
   versionFetcher.fetch(),
   scheduleFetcher.fetch(),
  ]);
  return { inputs: fetchResult.inputs, scheduleData: schedule };
 }).pipe(
  Effect.catchTag("NetworkError", () =>
   Effect.succeed({
    inputs: nodeDefaultInputs,
    scheduleData: nodeDefaultSchedule,
   }),
  ),
 );

 yield* cache.updateSchedule(scheduleData);
 yield* cache.loadFromInputs(inputs);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const AutoNodeCacheLive: Layer.Layer<
 NodeReleaseCache,
 never,
 NodeVersionFetcher | NodeScheduleFetcher
> = BaseCacheLayer.pipe(
 Layer.tap(() => setup),
);
```

Note: `Layer.tap` runs the setup effect after the base Layer is constructed, using the already-provided `NodeReleaseCache`. The `setup` effect accesses fetchers from the outer requirements. `nodeDefaultInputs` and `nodeDefaultSchedule` are imported from generated defaults — these are created in Task 15 (Chunk 4). Until then, the implementer should use stub data or implement Task 15 first.

- [ ] **Step 2: Write FreshNodeCacheLive**

```typescript
// src/layers/FreshNodeCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { FreshnessError } from "../errors/FreshnessError.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeScheduleFetcher } from "../services/NodeScheduleFetcher.js";
import { NodeVersionFetcher } from "../services/NodeVersionFetcher.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
 const cache = yield* NodeReleaseCache;
 const versionFetcher = yield* NodeVersionFetcher;
 const scheduleFetcher = yield* NodeScheduleFetcher;

 const [fetchResult, scheduleData] = yield* Effect.all([
  versionFetcher.fetch(),
  scheduleFetcher.fetch(),
 ]).pipe(
  Effect.catchTag("NetworkError", (err) =>
   Effect.fail(
    new FreshnessError({
     strategy: "api",
     message: `Fresh data required but network unavailable: ${err.message}`,
    }),
   ),
  ),
 );

 yield* cache.updateSchedule(scheduleData);
 yield* cache.loadFromInputs(fetchResult.inputs);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const FreshNodeCacheLive: Layer.Layer<
 NodeReleaseCache,
 FreshnessError,
 NodeVersionFetcher | NodeScheduleFetcher
> = BaseCacheLayer.pipe(
 Layer.tap(() => freshSetup),
);
```

- [ ] **Step 3: Write OfflineNodeCacheLive**

```typescript
// src/layers/OfflineNodeCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { nodeDefaultInputs, nodeDefaultSchedule } from "../data/node-defaults.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeReleaseCacheLive } from "./NodeReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
 const cache = yield* NodeReleaseCache;
 yield* cache.updateSchedule(nodeDefaultSchedule);
 yield* cache.loadFromInputs(nodeDefaultInputs);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = NodeReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const OfflineNodeCacheLive: Layer.Layer<NodeReleaseCache> = BaseCacheLayer.pipe(
 Layer.tap(() => offlineSetup),
);
```

- [ ] **Step 4: Write test for AutoNodeCacheLive (with mock fetchers)**

The test should verify:

- When fetchers succeed, cache uses fetched data
- When fetchers fail with NetworkError, cache falls back to defaults

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run src/layers/AutoNodeCacheLive.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/layers/AutoNodeCacheLive.ts src/layers/FreshNodeCacheLive.ts src/layers/OfflineNodeCacheLive.ts src/layers/AutoNodeCacheLive.test.ts
git commit -m "feat: add Node freshness Layer variants (Auto/Fresh/Offline)

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 14: Freshness Layer Variants — Bun and Deno

**Files:**

- Create: `src/layers/AutoBunCacheLive.ts`
- Create: `src/layers/FreshBunCacheLive.ts`
- Create: `src/layers/OfflineBunCacheLive.ts`
- Create: `src/layers/AutoDenoCacheLive.ts`
- Create: `src/layers/FreshDenoCacheLive.ts`
- Create: `src/layers/OfflineDenoCacheLive.ts`

**Context:** Same pattern as Node but simpler — no schedule, uses `RuntimeReleaseInput` and `BunRelease.fromInput`/`DenoRelease.fromInput`. Fallback defaults use the lean input arrays from generated defaults.

Note: The generated defaults files need to be updated to export lean inputs (Task 17) before these can work with the new format. In the interim, the implementer should create them with the correct interface and use stub defaults data. They will be fully wired in Task 17.

- [ ] **Step 1: Write AutoBunCacheLive**

```typescript
// src/layers/AutoBunCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { bunDefaultInputs } from "../data/bun-defaults.js";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const setup = Effect.gen(function* () {
 const cache = yield* BunReleaseCache;
 const fetcher = yield* BunVersionFetcher;

 const inputs = yield* fetcher.fetch().pipe(
  Effect.map((result) => result.inputs),
  Effect.catchTag("NetworkError", () => Effect.succeed(bunDefaultInputs)),
 );

 const releases = yield* Effect.all(
  inputs.map((input) => BunRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const AutoBunCacheLive: Layer.Layer<
 BunReleaseCache,
 never,
 BunVersionFetcher
> = BaseCacheLayer.pipe(Layer.tap(() => setup));
```

- [ ] **Step 2: Write FreshBunCacheLive**

```typescript
// src/layers/FreshBunCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { BunRelease } from "../schemas/bun-release.js";
import { FreshnessError } from "../errors/FreshnessError.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
 const cache = yield* BunReleaseCache;
 const fetcher = yield* BunVersionFetcher;

 const { inputs } = yield* fetcher.fetch().pipe(
  Effect.catchTag("NetworkError", (err) =>
   Effect.fail(
    new FreshnessError({
     strategy: "api",
     message: `Fresh data required but network unavailable: ${err.message}`,
    }),
   ),
  ),
 );

 const releases = yield* Effect.all(
  inputs.map((input) => BunRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const FreshBunCacheLive: Layer.Layer<
 BunReleaseCache,
 FreshnessError,
 BunVersionFetcher
> = BaseCacheLayer.pipe(Layer.tap(() => freshSetup));
```

- [ ] **Step 3: Write OfflineBunCacheLive**

```typescript
// src/layers/OfflineBunCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { bunDefaultInputs } from "../data/bun-defaults.js";
import { BunRelease } from "../schemas/bun-release.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunReleaseCacheLive } from "./BunReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
 const cache = yield* BunReleaseCache;
 const releases = yield* Effect.all(
  bunDefaultInputs.map((input) => BunRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as BunRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = BunReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const OfflineBunCacheLive: Layer.Layer<BunReleaseCache> = BaseCacheLayer.pipe(
 Layer.tap(() => offlineSetup),
);
```

- [ ] **Step 4: Write AutoDenoCacheLive**

```typescript
// src/layers/AutoDenoCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { denoDefaultInputs } from "../data/deno-defaults.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const setup = Effect.gen(function* () {
 const cache = yield* DenoReleaseCache;
 const fetcher = yield* DenoVersionFetcher;

 const inputs = yield* fetcher.fetch().pipe(
  Effect.map((result) => result.inputs),
  Effect.catchTag("NetworkError", () => Effect.succeed(denoDefaultInputs)),
 );

 const releases = yield* Effect.all(
  inputs.map((input) => DenoRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as DenoRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const AutoDenoCacheLive: Layer.Layer<
 DenoReleaseCache,
 never,
 DenoVersionFetcher
> = BaseCacheLayer.pipe(Layer.tap(() => setup));
```

- [ ] **Step 5: Write FreshDenoCacheLive**

```typescript
// src/layers/FreshDenoCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { DenoRelease } from "../schemas/deno-release.js";
import { FreshnessError } from "../errors/FreshnessError.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoVersionFetcher } from "../services/DenoVersionFetcher.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const freshSetup = Effect.gen(function* () {
 const cache = yield* DenoReleaseCache;
 const fetcher = yield* DenoVersionFetcher;

 const { inputs } = yield* fetcher.fetch().pipe(
  Effect.catchTag("NetworkError", (err) =>
   Effect.fail(
    new FreshnessError({
     strategy: "api",
     message: `Fresh data required but network unavailable: ${err.message}`,
    }),
   ),
  ),
 );

 const releases = yield* Effect.all(
  inputs.map((input) => DenoRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as DenoRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const FreshDenoCacheLive: Layer.Layer<
 DenoReleaseCache,
 FreshnessError,
 DenoVersionFetcher
> = BaseCacheLayer.pipe(Layer.tap(() => freshSetup));
```

- [ ] **Step 6: Write OfflineDenoCacheLive**

```typescript
// src/layers/OfflineDenoCacheLive.ts
import { Effect, Layer } from "effect";
import { SemVerParserLive, VersionCacheLive as SemVerVersionCacheLive } from "semver-effect";
import { denoDefaultInputs } from "../data/deno-defaults.js";
import { DenoRelease } from "../schemas/deno-release.js";
import { DenoReleaseCache } from "../services/DenoReleaseCache.js";
import { DenoReleaseCacheLive } from "./DenoReleaseCacheLive.js";

const offlineSetup = Effect.gen(function* () {
 const cache = yield* DenoReleaseCache;
 const releases = yield* Effect.all(
  denoDefaultInputs.map((input) => DenoRelease.fromInput(input)),
  { concurrency: "unbounded" },
 ).pipe(Effect.orElseSucceed(() => [] as DenoRelease[]));
 yield* cache.load(releases);
});

const SemVerLayer = Layer.merge(SemVerVersionCacheLive, SemVerParserLive);
const BaseCacheLayer = DenoReleaseCacheLive.pipe(Layer.provide(SemVerLayer));

export const OfflineDenoCacheLive: Layer.Layer<DenoReleaseCache> = BaseCacheLayer.pipe(
 Layer.tap(() => offlineSetup),
);
```

- [ ] **Step 7: Write a basic test for AutoBunCacheLive**

```typescript
// src/layers/AutoBunCacheLive.test.ts
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunVersionFetcher } from "../services/BunVersionFetcher.js";
import { AutoBunCacheLive } from "./AutoBunCacheLive.js";

const MockBunVersionFetcher = Layer.succeed(BunVersionFetcher, {
 fetch: () =>
  Effect.succeed({
   versions: [],
   inputs: [
    { version: "1.2.3", date: "2025-01-15" },
    { version: "1.1.0", date: "2025-01-01" },
   ],
  }),
});

const TestLayer = AutoBunCacheLive.pipe(Layer.provide(MockBunVersionFetcher));

describe("AutoBunCacheLive", () => {
 it("populates cache from fetcher", async () => {
  const program = Effect.gen(function* () {
   const cache = yield* BunReleaseCache;
   const releases = yield* cache.releases();
   expect(releases.length).toBe(2);
  });
  await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));
 });
});
```

- [ ] **Step 8: Run tests, verify pass**

Run: `pnpm vitest run src/layers/AutoBunCacheLive.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/layers/AutoBunCacheLive.ts src/layers/FreshBunCacheLive.ts src/layers/OfflineBunCacheLive.ts src/layers/AutoDenoCacheLive.ts src/layers/FreshDenoCacheLive.ts src/layers/OfflineDenoCacheLive.ts src/layers/AutoBunCacheLive.test.ts
git commit -m "feat: add Bun and Deno freshness Layer variants

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 4: Defaults Generator and Resolver Redesign (Phases 4-5)

### Task 15: Update Generated Defaults Format

**Files:**

- Modify: `lib/scripts/generate-defaults.mts`
- Modify: `src/data/node-defaults.ts` (output format changes)
- Modify: `src/data/bun-defaults.ts` (output format changes)
- Modify: `src/data/deno-defaults.ts` (output format changes)

**Context:** Generated files change from raw JSON blobs (`NodeDistVersion[]`, `GitHubTag[]`) to lean typed input arrays (`NodeReleaseInput[]`, `RuntimeReleaseInput[]`). Node defaults also export the schedule as a const object.

- [ ] **Step 1: Update imports in `generate-defaults.mts`**

Replace the old imports with lean types:

```typescript
// Remove these imports:
// import type { GitHubTag } from "../../src/schemas/github.js";
// import { GitHubTagList } from "../../src/schemas/github.js";
// import type { NodeDistVersion, ReleaseScheduleEntry } from "../../src/schemas/node.js";
// import { NodeDistIndex, NodeReleaseSchedule } from "../../src/schemas/node.js";

// Keep these:
import { GitHubClient } from "../../src/services/GitHubClient.js";
import { GitHubClientLive } from "../../src/layers/GitHubClientLive.js";
import { GitHubTokenAuth } from "../../src/layers/GitHubTokenAuth.js";
import { ParseError } from "../../src/errors/ParseError.js";

// Add these for schema validation of raw API responses:
import { NodeDistIndex, NodeReleaseSchedule } from "../../src/schemas/node.js";
import { GitHubReleaseList } from "../../src/schemas/github.js";
```

- [ ] **Step 2: Rewrite `generateNodeDefaults` for lean output**

```typescript
function generateNodeDefaults(
 versions: ReadonlyArray<{ version: string; npm?: string; date: string; [k: string]: unknown }>,
 schedule: Record<string, { start: string; end: string; lts?: string; maintenance?: string; codename?: string }>,
): string {
 const inputs = versions.map((v) => ({
  version: v.version.replace(/^v/, ""),
  npm: v.npm ?? "0.0.0",
  date: v.date,
 }));
 const lines: string[] = [
  GENERATED_HEADER,
  `import type { NodeReleaseInput } from "../schemas/node-release.js";`,
  `import type { NodeScheduleData } from "../schemas/node-schedule.js";`,
  "",
  `export const nodeDefaultInputs: ReadonlyArray<NodeReleaseInput> = ${JSON.stringify(inputs, null, "\t")} as const;`,
  "",
  `export const nodeDefaultSchedule: NodeScheduleData = ${JSON.stringify(schedule, null, "\t")} as const;`,
  "",
 ];
 return lines.join("\n");
}
```

- [ ] **Step 3: Replace `generateTagDefaults` with `generateReleaseDefaults`**

```typescript
function generateReleaseDefaults(
 runtime: "bun" | "deno",
 releases: ReadonlyArray<{ tag_name: string; published_at: string | null; draft: boolean; prerelease: boolean; [k: string]: unknown }>,
): string {
 const prefix = runtime === "bun" ? "bun-" : "";
 const inputs = releases
  .filter((r) => !r.draft && !r.prerelease)
  .map((r) => {
   let version = r.tag_name;
   if (version.startsWith(prefix)) version = version.slice(prefix.length);
   if (version.startsWith("v") || version.startsWith("V")) version = version.slice(1);
   return {
    version,
    date: r.published_at ?? "",
   };
  })
  .filter((input) => /^\d+\.\d+\.\d+/.test(input.version));

 const varName = `${runtime}DefaultInputs`;
 const lines: string[] = [
  GENERATED_HEADER,
  `import type { RuntimeReleaseInput } from "../schemas/runtime-release.js";`,
  "",
  `export const ${varName}: ReadonlyArray<RuntimeReleaseInput> = ${JSON.stringify(inputs, null, "\t")} as const;`,
  "",
 ];
 return lines.join("\n");
}
```

- [ ] **Step 3b: Update the main program to use `listReleases` for Bun/Deno and call the new functions**

```typescript
const program = Effect.gen(function* () {
 const client = yield* GitHubClient;
 console.log("Fetching runtime data...");

 const [bunReleases, denoReleases, nodeVersions, schedule] = yield* Effect.all([
  client.listReleases("oven-sh", "bun", { perPage: 100 }),
  client.listReleases("denoland", "deno", { perPage: 100 }),
  client.getJson("https://nodejs.org/dist/index.json", nodeDistSchema),
  client.getJson("https://raw.githubusercontent.com/nodejs/Release/main/schedule.json", scheduleSchema),
 ]);

 const nodeContent = generateNodeDefaults(nodeVersions, schedule);
 const bunContent = generateReleaseDefaults("bun", bunReleases);
 const denoContent = generateReleaseDefaults("deno", denoReleases);

 const nodeChanged = writeIfChanged(path.join(DATA_DIR, "node-defaults.ts"), nodeContent);
 const bunChanged = writeIfChanged(path.join(DATA_DIR, "bun-defaults.ts"), bunContent);
 const denoChanged = writeIfChanged(path.join(DATA_DIR, "deno-defaults.ts"), denoContent);

 return { nodeChanged, bunChanged, denoChanged,
  nodeVersions: nodeVersions.length, bunReleases: bunReleases.length, denoReleases: denoReleases.length };
});
```

- [ ] **Step 4: Run the generator locally to produce new defaults files**

Run: `pnpm tsx lib/scripts/generate-defaults.mts`
(Requires `GITHUB_PERSONAL_ACCESS_TOKEN` or `GITHUB_TOKEN` env var)

If no token available, manually create stub defaults files matching the new schema for development.

- [ ] **Step 5: Format generated files**

Run: `pnpm run lint:fix`

- [ ] **Step 6: Run full test suite**

Run: `pnpm vitest run`
Expected: Some existing tests may fail due to changed defaults format — these will be fixed in Task 16.

- [ ] **Step 7: Commit**

```bash
git add lib/scripts/generate-defaults.mts src/data/node-defaults.ts src/data/bun-defaults.ts src/data/deno-defaults.ts
git commit -m "feat: lean generated defaults with typed input arrays

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 16: Rewire Resolvers as Thin Orchestrators

**Files:**

- Modify: `src/services/NodeResolver.ts` — remove `resolveVersion`, remove `freshness` from options
- Modify: `src/services/BunResolver.ts` — same
- Modify: `src/services/DenoResolver.ts` — same
- Modify: `src/layers/NodeResolverLive.ts` — thin orchestrator using `NodeReleaseCache`
- Modify: `src/layers/BunResolverLive.ts` — thin orchestrator using `BunReleaseCache`
- Modify: `src/layers/DenoResolverLive.ts` — thin orchestrator using `DenoReleaseCache`
- Modify: `src/services/NodeResolver.test.ts` — remove resolveVersion tests, update mocks
- Modify: `src/services/BunResolver.test.ts` — same
- Modify: `src/services/DenoResolver.test.ts` — same

**Context:** Resolvers become thin orchestrators. They query `RuntimeCache` for releases, apply domain filters (phases for Node), apply increment grouping, handle defaults, and return `ResolvedVersions`. The `freshness` option is removed — it's a Layer concern now. `resolveVersion` is removed — consumers use the cache directly.

- [ ] **Step 1: Update NodeResolver service interface**

Remove `resolveVersion` and `freshness` from options:

```typescript
export interface NodeResolverOptions {
 readonly semverRange?: string;
 readonly defaultVersion?: string;
 readonly phases?: ReadonlyArray<NodePhase>;
 readonly increments?: Increments;
 readonly date?: Date;
}

export interface NodeResolver {
 readonly resolve: (options?: NodeResolverOptions) => Effect.Effect<ResolvedVersions, NodeResolverError>;
}
```

- [ ] **Step 2: Update BunResolver and DenoResolver interfaces similarly**

Remove `resolveVersion` and `freshness` from both.

- [ ] **Step 3: Rewrite NodeResolverLive as thin orchestrator**

The new implementation should:

1. Depend on `NodeReleaseCache` instead of `GitHubClient | VersionCache`
2. Query cache for all releases matching the range
3. Filter by phases using effectful `release.phase(date)`
4. Apply increment grouping via cache's `latestByMajor`/`latestByMinor`
5. Handle default version
6. Return `ResolvedVersions`

```typescript
// src/layers/NodeResolverLive.ts
import { DateTime, Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import type { NodeRelease } from "../schemas/node-release.js";
import type { Increments, NodePhase, ResolvedVersions } from "../schemas/common.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeResolver, type NodeResolverOptions } from "../services/NodeResolver.js";

export const NodeResolverLive: Layer.Layer<NodeResolver, never, NodeReleaseCache> = Layer.effect(
 NodeResolver,
 Effect.gen(function* () {
  const cache = yield* NodeReleaseCache;

  return {
   resolve: (options?: NodeResolverOptions) =>
    Effect.gen(function* () {
     const semverRange = options?.semverRange ?? "*";
     const phases: ReadonlyArray<NodePhase> = options?.phases ?? ["current", "active-lts"];
     const increments = options?.increments ?? "latest";
     const now = options?.date
      ? DateTime.unsafeMake(options.date)
      : DateTime.unsafeMake(new Date());

     // Get all releases matching range
     const matching = yield* cache.filter(semverRange);

     // Filter by phase
     const phaseFiltered: NodeRelease[] = [];
     for (const r of matching) {
      const phase = yield* r.phase(now);
      if (phase && phases.includes(phase)) {
       phaseFiltered.push(r);
      }
     }

     // Apply increments — group phaseFiltered by major/minor, pick latest each
     let resultReleases: NodeRelease[];
     if (increments === "latest") {
      const groups = new Map<number, NodeRelease>();
      for (const r of phaseFiltered) {
       const existing = groups.get(r.version.major);
       if (!existing || SemVer.gt(r.version, existing.version)) {
        groups.set(r.version.major, r);
       }
      }
      resultReleases = [...groups.values()];
     } else if (increments === "minor") {
      const groups = new Map<string, NodeRelease>();
      for (const r of phaseFiltered) {
       const key = `${r.version.major}.${r.version.minor}`;
       const existing = groups.get(key);
       if (!existing || SemVer.gt(r.version, existing.version)) {
        groups.set(key, r);
       }
      }
      resultReleases = [...groups.values()];
     } else {
      resultReleases = phaseFiltered;
     }

     if (resultReleases.length === 0) {
      return yield* Effect.fail(
       new VersionNotFoundError({
        runtime: "node",
        constraint: semverRange,
        message: `No Node.js versions found matching "${semverRange}" with phases [${phases.join(", ")}]`,
       }),
      );
     }

     // Sort descending
     const sorted = SemVer.rsort(resultReleases.map((r) => r.version));
     const sortedReleases = sorted
      .map((v) => resultReleases.find((r) => SemVer.equal(r.version, v)))
      .filter((r): r is NodeRelease => r !== undefined);

     const versions = sortedReleases.map((r) => r.version.toString());
     const latest = versions[0];

     // Determine LTS
     const ltsReleases = yield* cache.ltsReleases(now);
     const ltsVersions = ltsReleases
      .filter((r) => versions.includes(r.version.toString()))
      .map((r) => r.version);
     const lts = ltsVersions.length > 0
      ? SemVer.rsort(ltsVersions)[0].toString()
      : undefined;

     // Handle default version
     let resolvedDefault: string | undefined;
     if (options?.defaultVersion) {
      const defaultResult = yield* cache.resolve(options.defaultVersion).pipe(
       Effect.map((r) => r.version.toString()),
       Effect.catchAll(() => Effect.succeed(undefined)),
      );
      resolvedDefault = defaultResult;
     }

     return {
      source: "api" as const,
      versions,
      latest,
      ...(lts ? { lts } : {}),
      ...(resolvedDefault ? { default: resolvedDefault } : { ...(lts ? { default: lts } : {}) }),
     };
    }),
  };
 }),
);
```

The resolver now works with `NodeRelease` objects. The `filterByIncrements` and `resolveVersionFromList` utilities from `src/lib/semver-utils.ts` are no longer needed — increment grouping is done inline on the phase-filtered subset using `Map` keyed by major/minor.

- [ ] **Step 4: Rewrite BunResolverLive as thin orchestrator**

```typescript
// Key change in BunResolverLive.ts:
import { DateTime, Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import type { BunRelease } from "../schemas/bun-release.js";
import type { Increments, ResolvedVersions } from "../schemas/common.js";
import { VersionNotFoundError } from "../errors/VersionNotFoundError.js";
import { BunReleaseCache } from "../services/BunReleaseCache.js";
import { BunResolver, type BunResolverOptions } from "../services/BunResolver.js";

export const BunResolverLive: Layer.Layer<BunResolver, never, BunReleaseCache> = Layer.effect(
 BunResolver,
 Effect.gen(function* () {
  const cache = yield* BunReleaseCache;

  return {
   resolve: (options?: BunResolverOptions) =>
    Effect.gen(function* () {
     const semverRange = options?.semverRange ?? "*";
     const increments: Increments = options?.increments ?? "latest";

     const matching = yield* cache.filter(semverRange);

     let resultReleases: BunRelease[];
     if (increments === "latest") {
      const groups = new Map<number, BunRelease>();
      for (const r of matching) {
       const existing = groups.get(r.version.major);
       if (!existing || SemVer.gt(r.version, existing.version)) {
        groups.set(r.version.major, r);
       }
      }
      resultReleases = [...groups.values()];
     } else if (increments === "minor") {
      const groups = new Map<string, BunRelease>();
      for (const r of matching) {
       const key = `${r.version.major}.${r.version.minor}`;
       const existing = groups.get(key);
       if (!existing || SemVer.gt(r.version, existing.version)) {
        groups.set(key, r);
       }
      }
      resultReleases = [...groups.values()];
     } else {
      resultReleases = matching;
     }

     if (resultReleases.length === 0) {
      return yield* Effect.fail(
       new VersionNotFoundError({
        runtime: "bun",
        constraint: semverRange,
        message: `No Bun versions found matching "${semverRange}"`,
       }),
      );
     }

     const sorted = SemVer.rsort(resultReleases.map((r) => r.version));
     const versions = sorted.map((v) => v.toString());
     const latest = versions[0];

     let resolvedDefault: string | undefined;
     if (options?.defaultVersion) {
      resolvedDefault = yield* cache.resolve(options.defaultVersion).pipe(
       Effect.map((r) => r.version.toString()),
       Effect.catchAll(() => Effect.succeed(undefined)),
      );
     }

     return {
      source: "api" as const,
      versions,
      latest,
      ...(resolvedDefault ? { default: resolvedDefault } : {}),
     };
    }),
  };
 }),
);
```

- [ ] **Step 4b: Rewrite DenoResolverLive (identical pattern, swap Bun→Deno)**

Same as BunResolverLive above but using `DenoReleaseCache`, `DenoResolver`, `DenoResolverOptions`, `DenoRelease`, and `runtime: "deno"`.

- [ ] **Step 5: Update all resolver tests**

Update mocks to provide cache services instead of `GitHubClient | VersionCache`. Remove freshness option tests and `resolveVersion` tests.

```typescript
// Example: updated NodeResolver.test.ts mock setup
import { Effect, Layer } from "effect";
import { SemVer } from "semver-effect";
import { NodeReleaseCache } from "../services/NodeReleaseCache.js";
import { NodeResolver } from "../services/NodeResolver.js";
import { NodeResolverLive } from "../layers/NodeResolverLive.js";

// Create a mock NodeReleaseCache that provides test releases
const MockNodeReleaseCache = Layer.succeed(NodeReleaseCache, {
 filter: (range: string) =>
  Effect.succeed([/* test NodeRelease instances */]),
 resolve: (constraint: string) =>
  Effect.succeed(/* test NodeRelease */),
 ltsReleases: (now) =>
  Effect.succeed([/* test LTS releases */]),
 currentReleases: (now) =>
  Effect.succeed([/* test current releases */]),
 releases: () =>
  Effect.succeed([/* all test releases */]),
 load: (releases) => Effect.void,
 loadFromInputs: (inputs) => Effect.void,
 updateSchedule: (data) => Effect.void,
});

const TestLayer = NodeResolverLive.pipe(Layer.provide(MockNodeReleaseCache));
// Use TestLayer in tests with Effect.provide(TestLayer)
```

For BunResolver.test.ts and DenoResolver.test.ts, same pattern with `BunReleaseCache`/`DenoReleaseCache` mocks. No `ltsReleases`/`currentReleases`/`updateSchedule`/`loadFromInputs` needed.

- [ ] **Step 6: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass (some tests removed, new tests added)

- [ ] **Step 7: Commit**

```bash
git add src/services/NodeResolver.ts src/services/BunResolver.ts src/services/DenoResolver.ts \
  src/layers/NodeResolverLive.ts src/layers/BunResolverLive.ts src/layers/DenoResolverLive.ts \
  src/services/NodeResolver.test.ts src/services/BunResolver.test.ts src/services/DenoResolver.test.ts
git commit -m "feat: rewire resolvers as thin cache orchestrators, remove resolveVersion

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 17: Update Public API and Exports

**Files:**

- Modify: `src/index.ts` — update Layer composition, exports
- Modify: `src/schemas/common.ts` — remove `Freshness` schema
- Delete: `src/schemas/cache.ts` — replaced by typed release classes
- Delete: `src/services/VersionCache.ts` — project-internal VersionCache service, replaced by RuntimeCache (not semver-effect's VersionCache, which is still used)
- Delete: `src/layers/VersionCacheLive.ts` — project-internal VersionCacheLive, replaced by RuntimeCacheLive (not semver-effect's VersionCacheLive, which is still used)
- Delete: `src/lib/node-phases.ts` — logic moved to NodeSchedule.phaseFor
- Delete: `src/lib/semver-utils.ts` — logic moved to RuntimeCache
- Delete: `src/lib/tag-normalizers.ts` — logic moved to fetcher implementations
- Delete: `src/lib/node-phases.test.ts`
- Delete: `src/lib/semver-utils.test.ts`
- Delete: `src/lib/tag-normalizers.test.ts`
- Delete: `src/services/VersionCache.test.ts` — tests old VersionCache service
- Modify: `src/schemas/schemas.test.ts` — remove references to `CachedNodeData`, `CachedTagData`, `Freshness`
- Modify: `src/index.test.ts` — update export checks
- Modify: `src/cli/commands/resolve.ts` — remove freshness option, rewire Layer composition
- Modify: `src/cli/index.ts` — update Layer composition to use cache layers

**Context:** This is the integration task that ties everything together. The public API changes: `resolveNode`/`resolveBun`/`resolveDeno` now compose cache layers instead of the old VersionCache + resolver layers. `Freshness` type is removed from exports. New types/services are exported.

- [ ] **Step 1: Remove Freshness from common.ts**

Remove the `Freshness` schema literal and its type export.

- [ ] **Step 2: Delete obsolete files**

Delete these files:

- `src/schemas/cache.ts`
- `src/services/VersionCache.ts`
- `src/services/VersionCache.test.ts`
- `src/layers/VersionCacheLive.ts`
- `src/lib/node-phases.ts`
- `src/lib/node-phases.test.ts`
- `src/lib/semver-utils.ts`
- `src/lib/semver-utils.test.ts`
- `src/lib/tag-normalizers.ts`
- `src/lib/tag-normalizers.test.ts`

Also update `src/schemas/schemas.test.ts` — remove any tests referencing `CachedNodeData`, `CachedTagData` from `./cache.js` or `Freshness` from `./common.js`. These types no longer exist.

- [ ] **Step 3: Update src/index.ts**

New Layer composition:

```typescript
import { Layer } from "effect";
import { GitHubAutoAuth } from "./layers/GitHubAutoAuth.js";
import { GitHubClientLive } from "./layers/GitHubClientLive.js";
import { AutoNodeCacheLive } from "./layers/AutoNodeCacheLive.js";
import { AutoBunCacheLive } from "./layers/AutoBunCacheLive.js";
import { AutoDenoCacheLive } from "./layers/AutoDenoCacheLive.js";
import { NodeResolverLive } from "./layers/NodeResolverLive.js";
import { BunResolverLive } from "./layers/BunResolverLive.js";
import { DenoResolverLive } from "./layers/DenoResolverLive.js";
import { NodeVersionFetcherLive } from "./layers/NodeVersionFetcherLive.js";
import { NodeScheduleFetcherLive } from "./layers/NodeScheduleFetcherLive.js";
import { BunVersionFetcherLive } from "./layers/BunVersionFetcherLive.js";
import { DenoVersionFetcherLive } from "./layers/DenoVersionFetcherLive.js";

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
const FetcherLayer = Layer.mergeAll(
 NodeVersionFetcherLive,
 NodeScheduleFetcherLive,
 BunVersionFetcherLive,
 DenoVersionFetcherLive,
).pipe(Layer.provide(GitHubLayer));

const NodeLayer = NodeResolverLive.pipe(
 Layer.provide(AutoNodeCacheLive),
 Layer.provide(FetcherLayer),
);

const BunLayer = BunResolverLive.pipe(
 Layer.provide(AutoBunCacheLive),
 Layer.provide(FetcherLayer),
);

const DenoLayer = DenoResolverLive.pipe(
 Layer.provide(AutoDenoCacheLive),
 Layer.provide(FetcherLayer),
);
```

Update exports: add new domain classes, cache services, and freshness layers. Remove `Freshness`, `CachedNodeData`, `CachedTagData`, and old `VersionCache` exports.

- [ ] **Step 4: Update CLI resolve command and entry point**

In `src/cli/commands/resolve.ts`:

- Remove the `--freshness` / `-f` option definition and its `Args` / `Options` usage
- Remove imports of `Freshness` type
- Remove `freshness` from the options object passed to resolvers
- The `resolve` command should now accept: `--range`, `--default`, `--phases` (Node only), `--increments`, and `--runtime`

In `src/cli/index.ts`:

- Replace the old Layer composition. Remove `VersionCacheLive` import and usage.
- Import the new cache/fetcher layers:

```typescript
import { AutoNodeCacheLive } from "../layers/AutoNodeCacheLive.js";
import { AutoBunCacheLive } from "../layers/AutoBunCacheLive.js";
import { AutoDenoCacheLive } from "../layers/AutoDenoCacheLive.js";
import { NodeVersionFetcherLive } from "../layers/NodeVersionFetcherLive.js";
import { NodeScheduleFetcherLive } from "../layers/NodeScheduleFetcherLive.js";
import { BunVersionFetcherLive } from "../layers/BunVersionFetcherLive.js";
import { DenoVersionFetcherLive } from "../layers/DenoVersionFetcherLive.js";
import { GitHubAutoAuth } from "../layers/GitHubAutoAuth.js";
import { GitHubClientLive } from "../layers/GitHubClientLive.js";

const GitHubLayer = GitHubClientLive.pipe(Layer.provide(GitHubAutoAuth));
const FetcherLayer = Layer.mergeAll(
 NodeVersionFetcherLive,
 NodeScheduleFetcherLive,
 BunVersionFetcherLive,
 DenoVersionFetcherLive,
).pipe(Layer.provide(GitHubLayer));

// Provide cache layers per runtime
const NodeLayer = NodeResolverLive.pipe(
 Layer.provide(AutoNodeCacheLive),
 Layer.provide(FetcherLayer),
);
const BunLayer = BunResolverLive.pipe(
 Layer.provide(AutoBunCacheLive),
 Layer.provide(FetcherLayer),
);
const DenoLayer = DenoResolverLive.pipe(
 Layer.provide(AutoDenoCacheLive),
 Layer.provide(FetcherLayer),
);
```

- [ ] **Step 5: Update index.test.ts**

Verify new exports are present, old exports removed.

- [ ] **Step 6: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 7: Run lint and typecheck**

Run: `pnpm run lint:fix && pnpm run typecheck`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: rewire public API with cache layers, remove Freshness/VersionCache

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

## Chunk 5: CI Auto-Release (Phase 6)

### Task 18: GitHub Actions Workflow for Daily Defaults Update

**Files:**

- Create: `.github/workflows/update-defaults.yml`

**Context:** Daily cron trigger. Regenerates defaults, checks for changes, builds, tests, creates changeset, commits, and pushes to trigger the release workflow.

- [ ] **Step 1: Write the workflow file**

```yaml
# .github/workflows/update-defaults.yml
name: Update Runtime Defaults

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6am UTC
  workflow_dispatch:  # Allow manual trigger

permissions:
  contents: write

jobs:
  update-defaults:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Generate defaults
        run: pnpm tsx lib/scripts/generate-defaults.mts
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet src/data/; then
            echo "changed=false" >> $GITHUB_OUTPUT
          else
            echo "changed=true" >> $GITHUB_OUTPUT
          fi

      - name: Build and test
        if: steps.changes.outputs.changed == 'true'
        run: |
          pnpm run lint:fix
          pnpm run build
          pnpm run test

      - name: Create changeset
        if: steps.changes.outputs.changed == 'true'
        run: |
          mkdir -p .changeset
          cat > .changeset/update-defaults.md << 'EOF'
---
"@spencerbeggs/runtime-resolver": patch
---

chore: update runtime defaults
EOF

      - name: Commit and push
        if: steps.changes.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add src/data/ .changeset/
          git commit -m "chore: update runtime defaults

          Signed-off-by: github-actions[bot] <github-actions[bot]@users.noreply.github.com>"
          git push
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/update-defaults.yml
git commit -m "ci: add daily runtime defaults update workflow

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```

---

### Task 19: Final Cleanup and Verification

**Files:**

- Verify: all files, full test suite, lint, typecheck, build

- [ ] **Step 1: Run full verification**

```bash
pnpm run lint:fix
pnpm run typecheck
pnpm vitest run
pnpm run build
```

- [ ] **Step 2: Verify no stale imports or references to deleted files**

Check for any remaining references to:

- `src/schemas/cache.ts` (`CachedNodeData`, `CachedTagData`)
- `src/services/VersionCache.ts` (the old `VersionCache`)
- `src/lib/node-phases.ts`
- `src/lib/semver-utils.ts`
- `src/lib/tag-normalizers.ts`
- `Freshness` type in options

Run: `grep -r "CachedNodeData\|CachedTagData\|services/VersionCache\|layers/VersionCacheLive\|schemas/cache\|node-phases\|semver-utils\|tag-normalizers\|Freshness" src/ --include="*.ts" | grep -v node_modules`

All matches (including test files) indicate stale references that must be removed. Note: this pattern targets project-internal paths (e.g., `services/VersionCache`) to avoid false-positive matches on semver-effect's `VersionCache` which is still used.

- [ ] **Step 3: Run full test suite one final time**

Run: `pnpm vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final cleanup and verification

Signed-off-by: C. Spencer Beggs <spencer@beggs.codes>"
```
