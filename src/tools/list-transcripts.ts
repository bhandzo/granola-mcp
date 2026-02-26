// ABOUTME: list-transcripts tool handler - lists Granola meetings that have transcripts
// ABOUTME: Returns same shape as list-notes; use get-transcript to fetch actual content
import { listNotes } from "./list-notes.js";

interface ListTranscriptsInput {
	date?: string;
	startDate?: string;
	endDate?: string;
	limit?: number;
}

interface TranscriptListItem {
	noteId: string;
	title: string;
	date: string;
}

export async function listTranscripts(input: ListTranscriptsInput): Promise<TranscriptListItem[]> {
	// All Granola docs with transcribe: true have transcripts.
	// We return the same list as list-notes since we can't cheaply check
	// transcript existence without fetching each one individually.
	return listNotes(input);
}
