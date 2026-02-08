// ABOUTME: list-notes tool handler - lists Granola meeting notes with date filtering
// ABOUTME: Returns array of {id, title, date} for each matching document
import { getDocumentsList } from "../api.js";

interface ListNotesInput {
	date?: string;
	startDate?: string;
	endDate?: string;
	limit?: number;
}

interface NoteListItem {
	id: string;
	title: string;
	date: string;
}

function parseDateFilter(dateStr: string): { start: Date; end: Date } {
	const now = new Date();
	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const todayEnd = new Date(todayStart);
	todayEnd.setDate(todayEnd.getDate() + 1);

	switch (dateStr.toLowerCase()) {
		case "today":
			return { start: todayStart, end: todayEnd };
		case "yesterday": {
			const yesterdayStart = new Date(todayStart);
			yesterdayStart.setDate(yesterdayStart.getDate() - 1);
			return { start: yesterdayStart, end: todayStart };
		}
		case "last week": {
			const weekAgo = new Date(todayStart);
			weekAgo.setDate(weekAgo.getDate() - 7);
			return { start: weekAgo, end: todayEnd };
		}
		case "last month": {
			const monthAgo = new Date(todayStart);
			monthAgo.setMonth(monthAgo.getMonth() - 1);
			return { start: monthAgo, end: todayEnd };
		}
		default: {
			// Treat as YYYY-MM-DD
			const dayStart = new Date(`${dateStr}T00:00:00`);
			const dayEnd = new Date(`${dateStr}T23:59:59.999`);
			return { start: dayStart, end: dayEnd };
		}
	}
}

export async function listNotes(input: ListNotesInput): Promise<NoteListItem[]> {
	const limit = input.limit ?? 25;
	const docs = await getDocumentsList();

	let filtered = docs.map((doc) => ({
		id: doc.id,
		title: doc.title || "Untitled",
		date: doc.created_at,
	}));

	// Apply date filtering
	if (input.date) {
		const { start, end } = parseDateFilter(input.date);
		filtered = filtered.filter((note) => {
			const noteDate = new Date(note.date);
			return noteDate >= start && noteDate < end;
		});
	} else if (input.startDate || input.endDate) {
		if (input.startDate) {
			const start = new Date(`${input.startDate}T00:00:00`);
			filtered = filtered.filter((note) => new Date(note.date) >= start);
		}
		if (input.endDate) {
			const end = new Date(`${input.endDate}T23:59:59.999`);
			filtered = filtered.filter((note) => new Date(note.date) <= end);
		}
	}

	// Sort by date descending (most recent first)
	filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

	return filtered.slice(0, limit);
}
