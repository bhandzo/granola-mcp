// ABOUTME: get-transcript tool handler - fetches full transcript of a Granola meeting
// ABOUTME: Returns formatted markdown with speaker labels (Me/System)
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { getDocumentBatch, getTranscriptSegments } from "../api.js";

interface GetTranscriptInput {
	noteId: string;
	path?: string;
}

export async function getTranscriptTool(input: GetTranscriptInput): Promise<string> {
	const segments = await getTranscriptSegments(input.noteId);

	if (segments.length === 0) {
		return "Transcript not available for this note.";
	}

	let formatted = "";
	for (const segment of segments) {
		if (segment.source === "microphone") {
			formatted += `**Me:** ${segment.text}\n\n`;
		} else if (segment.source === "system") {
			formatted += `**System:** ${segment.text}\n\n`;
		} else {
			formatted += `${segment.text}\n\n`;
		}
	}

	const content = formatted.trim();

	if (input.path) {
		const docs = await getDocumentBatch([input.noteId]);
		const doc = docs[0];
		const title = doc?.title || "Untitled";
		const date = doc?.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString();

		const frontmatter = [
			"---",
			`title: "${title.replace(/"/g, '\\"')}"`,
			`date: "${date}"`,
			`id: "${input.noteId}"`,
			"type: transcript",
			"---",
		].join("\n");

		const fileContent = `${frontmatter}\n\n${content}`.trim();
		await fs.mkdir(path.dirname(input.path), { recursive: true });
		await fs.writeFile(input.path, fileContent, "utf-8");
		return `Written to ${input.path}`;
	}

	return content;
}
