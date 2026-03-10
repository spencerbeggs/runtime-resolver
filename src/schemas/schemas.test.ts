import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { CachedNodeData, CachedTagData } from "./cache.js";
import { Freshness, Increments, NodePhase, ResolvedVersions, Runtime, Source } from "./common.js";
import { GitHubRelease, GitHubReleaseList, GitHubTag, GitHubTagCommit, GitHubTagList } from "./github.js";
import { NodeDistIndex, NodeDistVersion, NodeReleaseSchedule, ReleaseScheduleEntry } from "./node.js";

const decode = <A, I>(schema: Schema.Schema<A, I>) => Schema.decodeUnknownSync(schema);

describe("common schemas", () => {
	describe("Runtime", () => {
		it("accepts valid runtime values", () => {
			expect(decode(Runtime)("node")).toBe("node");
			expect(decode(Runtime)("bun")).toBe("bun");
			expect(decode(Runtime)("deno")).toBe("deno");
		});

		it("rejects invalid runtime values", () => {
			expect(() => decode(Runtime)("python")).toThrow();
			expect(() => decode(Runtime)("")).toThrow();
			expect(() => decode(Runtime)(123)).toThrow();
		});
	});

	describe("Source", () => {
		it("accepts valid source values", () => {
			expect(decode(Source)("api")).toBe("api");
			expect(decode(Source)("cache")).toBe("cache");
		});

		it("rejects invalid source values", () => {
			expect(() => decode(Source)("network")).toThrow();
			expect(() => decode(Source)(null)).toThrow();
		});
	});

	describe("Freshness", () => {
		it("accepts valid freshness values", () => {
			expect(decode(Freshness)("auto")).toBe("auto");
			expect(decode(Freshness)("api")).toBe("api");
			expect(decode(Freshness)("cache")).toBe("cache");
		});

		it("rejects invalid freshness values", () => {
			expect(() => decode(Freshness)("stale")).toThrow();
			expect(() => decode(Freshness)(undefined)).toThrow();
		});
	});

	describe("NodePhase", () => {
		it("accepts valid node phase values", () => {
			expect(decode(NodePhase)("current")).toBe("current");
			expect(decode(NodePhase)("active-lts")).toBe("active-lts");
			expect(decode(NodePhase)("maintenance-lts")).toBe("maintenance-lts");
			expect(decode(NodePhase)("end-of-life")).toBe("end-of-life");
		});

		it("rejects invalid node phase values", () => {
			expect(() => decode(NodePhase)("beta")).toThrow();
		});
	});

	describe("Increments", () => {
		it("accepts valid increment values", () => {
			expect(decode(Increments)("latest")).toBe("latest");
			expect(decode(Increments)("minor")).toBe("minor");
			expect(decode(Increments)("patch")).toBe("patch");
		});

		it("rejects invalid increment values", () => {
			expect(() => decode(Increments)("major")).toThrow();
		});
	});

	describe("ResolvedVersions", () => {
		it("accepts a valid resolved versions object", () => {
			const input = {
				source: "api",
				versions: ["22.0.0", "21.0.0"],
				latest: "22.0.0",
			};
			const result = decode(ResolvedVersions)(input);
			expect(result.source).toBe("api");
			expect(result.versions).toEqual(["22.0.0", "21.0.0"]);
			expect(result.latest).toBe("22.0.0");
		});

		it("accepts optional lts and default fields", () => {
			const input = {
				source: "cache",
				versions: ["20.0.0"],
				latest: "20.0.0",
				lts: "20.0.0",
				default: "20.0.0",
			};
			const result = decode(ResolvedVersions)(input);
			expect(result.lts).toBe("20.0.0");
			expect(result.default).toBe("20.0.0");
		});

		it("accepts without optional fields", () => {
			const input = {
				source: "api",
				versions: [],
				latest: "22.0.0",
			};
			const result = decode(ResolvedVersions)(input);
			expect(result.lts).toBeUndefined();
			expect(result.default).toBeUndefined();
		});

		it("rejects missing required fields", () => {
			expect(() => decode(ResolvedVersions)({ source: "api" })).toThrow();
			expect(() => decode(ResolvedVersions)({ versions: [], latest: "1.0.0" })).toThrow();
		});

		it("rejects invalid source value", () => {
			expect(() =>
				decode(ResolvedVersions)({
					source: "network",
					versions: [],
					latest: "1.0.0",
				}),
			).toThrow();
		});
	});
});

describe("node schemas", () => {
	describe("NodeDistVersion", () => {
		const validVersion = {
			version: "v22.0.0",
			date: "2024-04-24",
			files: ["linux-x64", "darwin-arm64"],
			lts: false,
			security: false,
		};

		it("accepts a valid node dist version", () => {
			const result = decode(NodeDistVersion)(validVersion);
			expect(result.version).toBe("v22.0.0");
			expect(result.date).toBe("2024-04-24");
			expect(result.files).toEqual(["linux-x64", "darwin-arm64"]);
			expect(result.lts).toBe(false);
			expect(result.security).toBe(false);
		});

		it("accepts lts as a string", () => {
			const input = { ...validVersion, lts: "Jod" };
			const result = decode(NodeDistVersion)(input);
			expect(result.lts).toBe("Jod");
		});

		it("accepts optional fields", () => {
			const input = {
				...validVersion,
				npm: "10.5.0",
				v8: "12.4.254.14",
				uv: "1.48.0",
				zlib: "1.3.0.1-motley-71660e1",
				openssl: "3.0.13+quic",
				modules: "127",
			};
			const result = decode(NodeDistVersion)(input);
			expect(result.npm).toBe("10.5.0");
			expect(result.v8).toBe("12.4.254.14");
			expect(result.uv).toBe("1.48.0");
			expect(result.zlib).toBe("1.3.0.1-motley-71660e1");
			expect(result.openssl).toBe("3.0.13+quic");
			expect(result.modules).toBe("127");
		});

		it("rejects missing required fields", () => {
			expect(() => decode(NodeDistVersion)({ version: "v22.0.0" })).toThrow();
		});

		it("rejects invalid lts value", () => {
			expect(() => decode(NodeDistVersion)({ ...validVersion, lts: true })).toThrow();
			expect(() => decode(NodeDistVersion)({ ...validVersion, lts: 123 })).toThrow();
		});
	});

	describe("NodeDistIndex", () => {
		it("accepts an array of NodeDistVersion", () => {
			const input = [
				{
					version: "v22.0.0",
					date: "2024-04-24",
					files: [],
					lts: false,
					security: false,
				},
			];
			const result = decode(NodeDistIndex)(input);
			expect(result).toHaveLength(1);
		});

		it("accepts an empty array", () => {
			expect(decode(NodeDistIndex)([])).toEqual([]);
		});
	});

	describe("ReleaseScheduleEntry", () => {
		it("accepts a valid entry with required fields", () => {
			const input = { start: "2024-04-24", end: "2027-04-30" };
			const result = decode(ReleaseScheduleEntry)(input);
			expect(result.start).toBe("2024-04-24");
			expect(result.end).toBe("2027-04-30");
		});

		it("accepts optional fields", () => {
			const input = {
				start: "2024-04-24",
				lts: "2024-10-29",
				maintenance: "2025-10-21",
				end: "2027-04-30",
				codename: "Jod",
			};
			const result = decode(ReleaseScheduleEntry)(input);
			expect(result.lts).toBe("2024-10-29");
			expect(result.maintenance).toBe("2025-10-21");
			expect(result.codename).toBe("Jod");
		});

		it("rejects missing required fields", () => {
			expect(() => decode(ReleaseScheduleEntry)({ start: "2024-04-24" })).toThrow();
			expect(() => decode(ReleaseScheduleEntry)({ end: "2027-04-30" })).toThrow();
		});
	});

	describe("NodeReleaseSchedule", () => {
		it("accepts a valid schedule record", () => {
			const input = {
				v22: { start: "2024-04-24", end: "2027-04-30" },
				v20: { start: "2023-04-18", end: "2026-04-30" },
			};
			const result = decode(NodeReleaseSchedule)(input);
			expect(result.v22.start).toBe("2024-04-24");
			expect(result.v20.end).toBe("2026-04-30");
		});

		it("accepts an empty record", () => {
			expect(decode(NodeReleaseSchedule)({})).toEqual({});
		});
	});
});

describe("github schemas", () => {
	describe("GitHubTagCommit", () => {
		it("accepts a valid commit", () => {
			const input = { sha: "abc123", url: "https://api.github.com/repos/foo/bar/commits/abc123" };
			const result = decode(GitHubTagCommit)(input);
			expect(result.sha).toBe("abc123");
			expect(result.url).toBe("https://api.github.com/repos/foo/bar/commits/abc123");
		});

		it("rejects missing fields", () => {
			expect(() => decode(GitHubTagCommit)({ sha: "abc123" })).toThrow();
		});
	});

	describe("GitHubTag", () => {
		const validTag = {
			name: "v1.0.0",
			zipball_url: "https://example.com/zip",
			tarball_url: "https://example.com/tar",
			commit: { sha: "abc123", url: "https://example.com/commit" },
			node_id: "MDM6UmVmMTIzNDU2Nzg5",
		};

		it("accepts a valid tag", () => {
			const result = decode(GitHubTag)(validTag);
			expect(result.name).toBe("v1.0.0");
			expect(result.commit.sha).toBe("abc123");
			expect(result.node_id).toBe("MDM6UmVmMTIzNDU2Nzg5");
		});

		it("rejects missing commit", () => {
			const { commit: _, ...noCommit } = validTag;
			expect(() => decode(GitHubTag)(noCommit)).toThrow();
		});
	});

	describe("GitHubTagList", () => {
		it("accepts an array of tags", () => {
			const input = [
				{
					name: "v1.0.0",
					zipball_url: "https://example.com/zip",
					tarball_url: "https://example.com/tar",
					commit: { sha: "abc", url: "https://example.com/c" },
					node_id: "id1",
				},
			];
			const result = decode(GitHubTagList)(input);
			expect(result).toHaveLength(1);
		});

		it("accepts an empty array", () => {
			expect(decode(GitHubTagList)([])).toEqual([]);
		});
	});

	describe("GitHubRelease", () => {
		it("accepts a valid release", () => {
			const input = {
				tag_name: "v1.0.0",
				name: "Release 1.0.0",
				draft: false,
				prerelease: false,
				published_at: "2024-01-01T00:00:00Z",
			};
			const result = decode(GitHubRelease)(input);
			expect(result.tag_name).toBe("v1.0.0");
			expect(result.name).toBe("Release 1.0.0");
			expect(result.draft).toBe(false);
			expect(result.prerelease).toBe(false);
		});

		it("accepts null for name and published_at", () => {
			const input = {
				tag_name: "v1.0.0",
				name: null,
				draft: false,
				prerelease: false,
				published_at: null,
			};
			const result = decode(GitHubRelease)(input);
			expect(result.name).toBeNull();
			expect(result.published_at).toBeNull();
		});

		it("rejects missing required fields", () => {
			expect(() => decode(GitHubRelease)({ tag_name: "v1.0.0" })).toThrow();
		});
	});

	describe("GitHubReleaseList", () => {
		it("accepts an array of releases", () => {
			const input = [
				{
					tag_name: "v1.0.0",
					name: "Release 1.0.0",
					draft: false,
					prerelease: false,
					published_at: "2024-01-01T00:00:00Z",
				},
			];
			expect(decode(GitHubReleaseList)(input)).toHaveLength(1);
		});
	});
});

describe("cache schemas", () => {
	describe("CachedNodeData", () => {
		it("accepts valid cached node data", () => {
			const input = {
				versions: [
					{
						version: "v22.0.0",
						date: "2024-04-24",
						files: ["linux-x64"],
						lts: false,
						security: false,
					},
				],
				schedule: {
					v22: { start: "2024-04-24", end: "2027-04-30" },
				},
			};
			const result = decode(CachedNodeData)(input);
			expect(result.versions).toHaveLength(1);
			expect(result.schedule.v22.start).toBe("2024-04-24");
		});

		it("accepts empty versions and schedule", () => {
			const input = { versions: [], schedule: {} };
			const result = decode(CachedNodeData)(input);
			expect(result.versions).toEqual([]);
			expect(result.schedule).toEqual({});
		});

		it("rejects missing fields", () => {
			expect(() => decode(CachedNodeData)({ versions: [] })).toThrow();
			expect(() => decode(CachedNodeData)({ schedule: {} })).toThrow();
		});

		it("rejects invalid version entries", () => {
			expect(() =>
				decode(CachedNodeData)({
					versions: [{ version: "v22.0.0" }],
					schedule: {},
				}),
			).toThrow();
		});
	});

	describe("CachedTagData", () => {
		it("accepts valid cached tag data", () => {
			const input = {
				tags: [
					{
						name: "v1.0.0",
						zipball_url: "https://example.com/zip",
						tarball_url: "https://example.com/tar",
						commit: { sha: "abc", url: "https://example.com/c" },
						node_id: "id1",
					},
				],
			};
			const result = decode(CachedTagData)(input);
			expect(result.tags).toHaveLength(1);
		});

		it("accepts empty tags array", () => {
			const result = decode(CachedTagData)({ tags: [] });
			expect(result.tags).toEqual([]);
		});

		it("rejects missing tags field", () => {
			expect(() => decode(CachedTagData)({})).toThrow();
		});

		it("rejects invalid tag entries", () => {
			expect(() => decode(CachedTagData)({ tags: [{ name: "v1.0.0" }] })).toThrow();
		});
	});
});
