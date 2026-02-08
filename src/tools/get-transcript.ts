// ABOUTME: get-transcript tool handler - fetches full transcript of a Granola meeting
// ABOUTME: Returns formatted markdown with speaker labels (Me/System)
import { getTranscriptSegments } from "../api.js";

interface GetTranscriptInput {
	noteId: string;
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

	return formatted.trim();
}
