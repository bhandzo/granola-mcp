// ABOUTME: get-note tool handler - fetches full content of a Granola note by ID
// ABOUTME: Supports enhanced (AI panels), original (user notes), or auto content selection
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { convertDocumentToMarkdown, getDocumentBatch, getDocumentPanels, getPanelId } from "../api.js";
import type { DocumentStructure, PanelsByDocId } from "../types.js";

interface GetNoteInput {
	noteId: string;
	contentType?: "enhanced" | "original" | "auto";
	path?: string;
}

function resolveEnhancedContent(panels: PanelsByDocId | undefined, documentId: string): string {
	if (!panels || !documentId || !panels[documentId]) {
		return "";
	}

	const panelId = getPanelId(panels, documentId);
	if (!panelId || !panels[documentId][panelId]) {
		return "";
	}

	const panelData = panels[documentId][panelId];

	if (panelData.content) {
		return convertDocumentToMarkdown(panelData.content);
	}
	if (panelData.original_content) {
		return panelData.original_content;
	}

	return "";
}

export async function getNote(input: GetNoteInput): Promise<string> {
	const { noteId, contentType = "auto" } = input;

	const docs = await getDocumentBatch([noteId]);
	if (docs.length === 0) {
		return `Note not found: ${noteId}`;
	}

	const doc = docs[0];
	const panels = (await getDocumentPanels(noteId)) ?? undefined;

	let content = "";

	if (contentType === "original") {
		content = doc.notes_markdown || "";
	} else if (contentType === "enhanced") {
		content = resolveEnhancedContent(panels, noteId);
		if (!content && doc.notes?.content) {
			content = convertDocumentToMarkdown(doc.notes as unknown as DocumentStructure);
		}
	} else {
		// "auto" - try enhanced first, fall back to original
		content = resolveEnhancedContent(panels, noteId);
		if (!content && doc.notes?.content) {
			content = convertDocumentToMarkdown(doc.notes as unknown as DocumentStructure);
		}
		if (!content && doc.notes_markdown) {
			content = doc.notes_markdown;
		}
	}

	const title = doc.title || "Untitled";
	const date = doc.created_at ? new Date(doc.created_at).toISOString() : new Date().toISOString();

	if (input.path) {
		const frontmatter = [
			"---",
			`title: "${title.replace(/"/g, '\\"')}"`,
			`date: "${date}"`,
			`noteId: "${noteId}"`,
			"type: note",
			"---",
		].join("\n");

		const fileContent = `${frontmatter}\n\n${content}`.trim();
		await fs.mkdir(path.dirname(input.path), { recursive: true });
		await fs.writeFile(input.path, fileContent, "utf-8");
		return `Written to ${input.path}`;
	}

	return `# ${title}\n\n**Date:** ${date}\n\n${content}`.trim();
}
