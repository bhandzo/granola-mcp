// ABOUTME: Tests for Granola API client - auth, headers, and fetch functions
// ABOUTME: Uses real API calls against live Granola API with local auth token
import { describe, expect, it } from "vitest";
import {
	createHeaders,
	getAccessToken,
	getDocumentNotesMarkdown,
	getDocumentPanels,
	getDocumentsList,
	getSupabaseConfigPath,
	getTranscriptSegments,
} from "../api.js";

describe("getSupabaseConfigPath", () => {
	it("returns a string path ending with supabase.json", () => {
		const path = getSupabaseConfigPath();
		expect(typeof path).toBe("string");
		expect(path.length).toBeGreaterThan(0);
		expect(path).toMatch(/supabase\.json$/);
	});

	it("includes Granola in the path", () => {
		const path = getSupabaseConfigPath();
		expect(path).toContain("Granola");
	});
});

describe("getAccessToken", () => {
	it("returns a non-empty string token", async () => {
		const token = await getAccessToken();
		expect(typeof token).toBe("string");
		expect(token.length).toBeGreaterThan(0);
	});
});

describe("createHeaders", () => {
	it("returns headers with Authorization and Content-Type", async () => {
		const headers = await createHeaders();
		expect(headers.Authorization).toMatch(/^Bearer .+/);
		expect(headers["Content-Type"]).toBe("application/json");
	});
});

describe("getDocumentsList", () => {
	it("returns an array of documents with id, title, created_at", async () => {
		const docs = await getDocumentsList();
		expect(Array.isArray(docs)).toBe(true);
		expect(docs.length).toBeGreaterThan(0);

		const doc = docs[0];
		expect(doc).toHaveProperty("id");
		expect(doc).toHaveProperty("title");
		expect(doc).toHaveProperty("created_at");
		expect(typeof doc.id).toBe("string");
		expect(typeof doc.title).toBe("string");
	});
});

describe("getTranscriptSegments", () => {
	it("returns segments with text, source, and timestamps for a known doc", async () => {
		// Get a real doc ID from the list
		const docs = await getDocumentsList();
		expect(docs.length).toBeGreaterThan(0);
		const docId = docs[0].id;

		const segments = await getTranscriptSegments(docId);
		expect(Array.isArray(segments)).toBe(true);
		// Some docs may not have transcripts, so we just verify the array shape
		if (segments.length > 0) {
			const seg = segments[0];
			expect(seg).toHaveProperty("text");
			expect(seg).toHaveProperty("source");
			expect(seg).toHaveProperty("start_timestamp");
		}
	});
});

describe("getDocumentNotesMarkdown", () => {
	it("returns a string for a known doc", async () => {
		const docs = await getDocumentsList();
		expect(docs.length).toBeGreaterThan(0);
		const docId = docs[0].id;

		const markdown = await getDocumentNotesMarkdown(docId);
		expect(typeof markdown).toBe("string");
	});
});

describe("getDocumentPanels", () => {
	it("returns panel data or null for a known doc", async () => {
		const docs = await getDocumentsList();
		expect(docs.length).toBeGreaterThan(0);
		const docId = docs[0].id;

		const panels = await getDocumentPanels(docId);
		// Panels can be null if none exist
		if (panels !== null) {
			expect(typeof panels).toBe("object");
			expect(panels).toHaveProperty(docId);
		}
	});
});
