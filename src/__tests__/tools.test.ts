// ABOUTME: Tests for MCP tool handler functions
// ABOUTME: Uses real API calls against live Granola API with local auth token
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getNote } from "../tools/get-note.js";
import { getTranscriptTool } from "../tools/get-transcript.js";
import { listNotes } from "../tools/list-notes.js";
import { listTranscripts } from "../tools/list-transcripts.js";

const TEST_OUTPUT_DIR = path.join(import.meta.dirname, "../../.test-output");

afterEach(async () => {
	await fs.rm(TEST_OUTPUT_DIR, { recursive: true, force: true });
});

describe("listNotes", () => {
	it("returns an array with noteId, title, date fields", async () => {
		const result = await listNotes({});
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBeGreaterThan(0);

		const note = result[0];
		expect(note).toHaveProperty("noteId");
		expect(note).toHaveProperty("title");
		expect(note).toHaveProperty("date");
		expect(typeof note.noteId).toBe("string");
		expect(typeof note.title).toBe("string");
		expect(typeof note.date).toBe("string");
	});

	it("respects the limit parameter", async () => {
		const result = await listNotes({ limit: 3 });
		expect(result.length).toBeLessThanOrEqual(3);
	});

	it("filters by date 'today'", async () => {
		const result = await listNotes({ date: "today" });
		expect(Array.isArray(result)).toBe(true);
		// Compare using local date since the filter uses local midnight boundaries
		const now = new Date();
		const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
		for (const note of result) {
			// Convert the note's UTC date to local date for comparison
			const noteLocal = new Date(note.date);
			const noteLocalStr = `${noteLocal.getFullYear()}-${String(noteLocal.getMonth() + 1).padStart(2, "0")}-${String(noteLocal.getDate()).padStart(2, "0")}`;
			expect(noteLocalStr).toBe(todayStr);
		}
	});

	it("filters by startDate and endDate range", async () => {
		const end = new Date();
		const start = new Date();
		start.setDate(start.getDate() - 7);
		const startStr = start.toISOString().slice(0, 10);
		const endStr = end.toISOString().slice(0, 10);

		const result = await listNotes({ startDate: startStr, endDate: endStr });
		expect(Array.isArray(result)).toBe(true);
		for (const note of result) {
			const noteDate = note.date.slice(0, 10);
			expect(noteDate >= startStr).toBe(true);
			expect(noteDate <= endStr).toBe(true);
		}
	});
});

describe("listTranscripts", () => {
	it("returns same shape as listNotes", async () => {
		const result = await listTranscripts({});
		expect(Array.isArray(result)).toBe(true);
		if (result.length > 0) {
			const note = result[0];
			expect(note).toHaveProperty("noteId");
			expect(note).toHaveProperty("title");
			expect(note).toHaveProperty("date");
		}
	});
});

describe("getNote", () => {
	it("returns markdown content for a valid note ID", async () => {
		// First get a real note ID
		const notes = await listNotes({ limit: 1 });
		expect(notes.length).toBeGreaterThan(0);
		const noteId = notes[0].noteId;

		const result = await getNote({ noteId });
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
		// Should contain the title as a header
		expect(result).toContain(notes[0].title);
	});

	it("returns content with contentType 'enhanced' when available", async () => {
		const notes = await listNotes({ limit: 1 });
		expect(notes.length).toBeGreaterThan(0);
		const noteId = notes[0].noteId;

		const result = await getNote({ noteId, contentType: "enhanced" });
		expect(typeof result).toBe("string");
	});
});

describe("getTranscriptTool", () => {
	it("returns formatted transcript with speaker labels for a valid doc", async () => {
		const notes = await listNotes({ limit: 5 });
		expect(notes.length).toBeGreaterThan(0);

		// Try to find a note that has a transcript
		let transcript = "";
		for (const note of notes) {
			transcript = await getTranscriptTool({ noteId: note.noteId });
			if (transcript.length > 0 && !transcript.includes("not available")) {
				break;
			}
		}

		expect(typeof transcript).toBe("string");
		// If we found a transcript, it should have speaker labels
		if (transcript.length > 0 && !transcript.includes("not available")) {
			expect(transcript).toMatch(/\*\*(Me|System):\*\*/);
		}
	});
});

describe("getNote with path (file output)", () => {
	it("writes a markdown file with YAML frontmatter when path is provided", async () => {
		const notes = await listNotes({ limit: 1 });
		expect(notes.length).toBeGreaterThan(0);
		const noteId = notes[0].noteId;

		await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
		const filePath = path.join(TEST_OUTPUT_DIR, "test-note.md");

		const result = await getNote({ noteId, path: filePath });

		// Should return a short confirmation, not the full content
		expect(result).toContain(filePath);
		expect(result.length).toBeLessThan(500);

		// File should exist and contain frontmatter
		const content = await fs.readFile(filePath, "utf-8");
		expect(content).toMatch(/^---\n/);
		expect(content).toContain("title:");
		expect(content).toContain("date:");
		expect(content).toContain("noteId:");
		expect(content).toContain("type: note");
		// Should have closing frontmatter delimiter followed by content
		expect(content).toMatch(/---\n\n/);
	});

	it("still returns inline content when no path is provided", async () => {
		const notes = await listNotes({ limit: 1 });
		expect(notes.length).toBeGreaterThan(0);
		const noteId = notes[0].noteId;

		const result = await getNote({ noteId });
		// Should return full content inline (starts with # heading)
		expect(result).toMatch(/^# /);
	});
});

describe("getTranscriptTool with path (file output)", () => {
	it("writes a markdown file with YAML frontmatter when path is provided", async () => {
		const notes = await listNotes({ limit: 5 });
		expect(notes.length).toBeGreaterThan(0);

		await fs.mkdir(TEST_OUTPUT_DIR, { recursive: true });
		const filePath = path.join(TEST_OUTPUT_DIR, "test-transcript.md");

		// Find a note with a transcript
		let result = "";
		let usedNoteId = "";
		for (const note of notes) {
			result = await getTranscriptTool({ noteId: note.noteId, path: filePath });
			if (result.includes(filePath)) {
				usedNoteId = note.noteId;
				break;
			}
		}

		if (usedNoteId) {
			// Should return a short confirmation
			expect(result).toContain(filePath);
			expect(result.length).toBeLessThan(500);

			// File should exist and contain frontmatter
			const content = await fs.readFile(filePath, "utf-8");
			expect(content).toMatch(/^---\n/);
			expect(content).toContain("title:");
			expect(content).toContain("noteId:");
			expect(content).toContain("type: transcript");
			expect(content).toMatch(/---\n\n/);
		}
	});

	it("still returns inline content when no path is provided", async () => {
		const notes = await listNotes({ limit: 5 });
		expect(notes.length).toBeGreaterThan(0);

		let transcript = "";
		for (const note of notes) {
			transcript = await getTranscriptTool({ noteId: note.noteId });
			if (transcript.length > 0 && !transcript.includes("not available")) {
				break;
			}
		}

		// Should return full content inline, not a file path reference
		if (transcript.length > 0 && !transcript.includes("not available")) {
			expect(transcript).not.toContain("Written to");
		}
	});
});
