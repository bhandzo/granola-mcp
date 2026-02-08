// ABOUTME: Shared TypeScript types for the Granola MCP server
// ABOUTME: Adapted from the Raycast extension types, stripped of React/Raycast dependencies

export interface NodeAttrs {
	id: string;
	isSelected?: boolean;
	level?: number;
	href?: string;
}

export interface ContentNode {
	type: string;
	attrs?: NodeAttrs;
	content?: ContentNode[];
	text?: string;
}

export interface Attachment {
	content: string;
	kind: string;
	name: string;
}

export interface DocumentStructure {
	attachments: Attachment[];
	type?: string;
	content?: ContentNode[];
}

export interface Document {
	id: string;
	created_at: string;
	notes: {
		type: string;
		content: Array<{
			type: string;
			attrs?: Record<string, unknown>;
			content?: Array<{ type: string; text?: string }>;
		}>;
	};
	title: string;
	user_id: string;
	notes_plain: string;
	transcribe: boolean;
	updated_at: string;
	deleted_at: string | null;
	public: boolean;
	people: unknown;
	notes_markdown: string;
	creation_source: string;
	sharing_link_visibility: string;
}

export interface TranscriptSegment {
	document_id: string;
	start_timestamp: string;
	text: string;
	source: "system" | "microphone" | string;
	id: string;
	is_final: boolean;
	end_timestamp: string;
}

interface PanelContent {
	original_content: string;
	content?: DocumentStructure;
}

export type PanelId = string;
export type DocId = string;

export interface PanelsByPanelId {
	[panelId: PanelId]: PanelContent;
}

export interface PanelsByDocId {
	[docId: DocId]: PanelsByPanelId;
}
