import { promises as fs } from "node:fs";
import * as os from "node:os";
// ABOUTME: Granola API client for authentication, headers, and data fetching
// ABOUTME: Reads local Granola auth tokens and communicates with the Granola API
import * as path from "node:path";
import type {
	Attachment,
	ContentNode,
	Document,
	DocumentStructure,
	PanelsByDocId,
	PanelsByPanelId,
	TranscriptSegment,
} from "./types.js";

const API_CONFIG = {
	API_URL: "https://api.granola.ai/v1",
	CLIENT_VERSION: "6.476.0",
	getUserAgent(): string {
		return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Granola/${this.CLIENT_VERSION} Chrome/136.0.7103.115 Electron/36.3.2 Safari/537.36`;
	},
};

export function getSupabaseConfigPath(): string {
	const homeDirectory = os.homedir();
	if (process.platform === "win32") {
		return path.join(homeDirectory, "AppData", "Roaming", "Granola", "supabase.json");
	}
	return path.join(homeDirectory, "Library", "Application Support", "Granola", "supabase.json");
}

export async function getAccessToken(): Promise<string> {
	const filePath = getSupabaseConfigPath();
	const fileContent = await fs.readFile(filePath, "utf8");
	const jsonData = JSON.parse(fileContent);

	let accessToken: string | undefined;

	// Try WorkOS tokens first (updated auth method)
	if (jsonData.workos_tokens) {
		try {
			let workosTokens: Record<string, unknown>;
			if (typeof jsonData.workos_tokens === "string") {
				workosTokens = JSON.parse(jsonData.workos_tokens);
			} else if (typeof jsonData.workos_tokens === "object" && jsonData.workos_tokens !== null) {
				workosTokens = jsonData.workos_tokens;
			} else {
				workosTokens = {};
			}
			if (workosTokens.access_token && typeof workosTokens.access_token === "string") {
				accessToken = workosTokens.access_token;
			}
		} catch {
			// Fall through to Cognito
		}
	}

	// Fallback to Cognito tokens
	if (!accessToken && jsonData.cognito_tokens) {
		try {
			let cognitoTokens: Record<string, unknown>;
			if (typeof jsonData.cognito_tokens === "string") {
				cognitoTokens = JSON.parse(jsonData.cognito_tokens);
			} else if (typeof jsonData.cognito_tokens === "object" && jsonData.cognito_tokens !== null) {
				cognitoTokens = jsonData.cognito_tokens;
			} else {
				cognitoTokens = {};
			}
			if (cognitoTokens.access_token && typeof cognitoTokens.access_token === "string") {
				accessToken = cognitoTokens.access_token;
			}
		} catch {
			// Fall through
		}
	}

	if (!accessToken) {
		throw new Error(
			"Access token not found in your local Granola data. Make sure Granola is installed, running, and that you are logged in.",
		);
	}

	return accessToken;
}

export async function createHeaders(extraHeaders: Record<string, string> = {}): Promise<Record<string, string>> {
	const token = await getAccessToken();
	return {
		Authorization: `Bearer ${token}`,
		"Content-Type": "application/json",
		"User-Agent": API_CONFIG.getUserAgent(),
		"X-Client-Version": API_CONFIG.CLIENT_VERSION,
		...extraHeaders,
	};
}

async function handleApiError(response: Response, operationName: string): Promise<never> {
	let errorMessage = `${operationName} failed: ${response.statusText}`;
	try {
		const errorBody = await response.text();
		if (errorBody) {
			try {
				const errorJson = JSON.parse(errorBody);
				if (errorJson.error) {
					errorMessage = `${operationName} failed: ${errorJson.error}`;
				} else if (errorJson.message) {
					errorMessage = `${operationName} failed: ${errorJson.message}`;
				}
			} catch {
				errorMessage = `${operationName} failed: ${errorBody}`;
			}
		}
	} catch {
		// Fall back to status text
	}
	throw new Error(errorMessage);
}

// --- Markdown conversion ---

function convertNodeToMarkdown(node: ContentNode): string {
	if (!node) return "";
	const newLine = "\n\n";
	switch (node.type) {
		case "paragraph":
			return (node.content?.map(convertNodeToMarkdown).join(" ") ?? "") + newLine;
		case "heading":
			return `${"#".repeat(node.attrs?.level || 1)} ${node.content?.map(convertNodeToMarkdown).join(" ") ?? ""} ${newLine}`;
		case "bulletList":
			return (node.content?.map(convertNodeToMarkdown).join("") ?? "") + newLine;
		case "listItem":
			return `- ${node.content?.map(convertNodeToMarkdown).join(" ") ?? ""} ${newLine}`;
		case "text":
			return node.text || "";
		case "horizontalRule":
			return `--- ${newLine}`;
		case "doc":
			return node.content ? node.content.map(convertNodeToMarkdown).join("") : "";
		default:
			return "";
	}
}

function convertDocumentToMarkdown(content: DocumentStructure | null | undefined): string {
	if (!content) return "";
	if (content.type === "doc") {
		return convertNodeToMarkdown(content as unknown as ContentNode);
	}
	if (Array.isArray(content.attachments)) {
		return content.attachments
			.map((attachment: Attachment) => {
				const parsedContent: ContentNode = JSON.parse(attachment.content);
				return convertNodeToMarkdown(parsedContent);
			})
			.join(" \n\n ");
	}
	return "";
}

// --- Data fetch functions ---

export async function getDocumentsList(): Promise<Document[]> {
	const url = "https://api.granola.ai/v2/get-documents";
	const token = await getAccessToken();
	const response = await fetch(url, {
		headers: { Authorization: `Bearer ${token}` },
	});

	if (!response.ok) {
		await handleApiError(response, "Get documents list");
	}

	const result = (await response.json()) as { docs?: Document[] };
	return Array.isArray(result?.docs) ? result.docs : [];
}

export async function getTranscriptSegments(docId: string): Promise<TranscriptSegment[]> {
	const headers = await createHeaders();
	const response = await fetch(`${API_CONFIG.API_URL}/get-document-transcript`, {
		method: "POST",
		headers,
		body: JSON.stringify({ document_id: docId }),
	});

	if (!response.ok) {
		await handleApiError(response, "Get transcript segments");
	}

	const segments = (await response.json()) as TranscriptSegment[];
	return segments || [];
}

export async function getDocumentNotesMarkdown(documentId: string): Promise<string> {
	const headers = await createHeaders();

	const sanitize = (value?: string): string => {
		if (!value) return "";
		const trimmed = value.trim();
		if (!trimmed || trimmed.toLowerCase() === "undefined") return "";
		return value;
	};

	const extractMarkdown = (doc?: Document): string => {
		if (!doc) return "";
		const md = sanitize(doc.notes_markdown);
		if (md) return md;
		if (doc.notes && Array.isArray(doc.notes.content) && doc.notes.content.length > 0) {
			const converted = sanitize(convertDocumentToMarkdown(doc.notes as unknown as DocumentStructure));
			if (converted) return converted;
		}
		const plain = sanitize(doc.notes_plain);
		if (plain) return plain;
		return "";
	};

	try {
		const batchResponse = await fetch(`${API_CONFIG.API_URL}/get-documents-batch`, {
			method: "POST",
			headers,
			body: JSON.stringify({ document_ids: [documentId] }),
		});

		if (batchResponse.ok) {
			const batchResult = (await batchResponse.json()) as { docs?: Document[] };
			const doc = batchResult.docs?.[0];
			const markdown = extractMarkdown(doc);
			if (markdown) return markdown;
		}
	} catch {
		// Fall through
	}

	return "";
}

export async function getDocumentPanels(documentId: string): Promise<PanelsByDocId | null> {
	const headers = await createHeaders();
	const response = await fetch(`${API_CONFIG.API_URL}/get-document-panels`, {
		method: "POST",
		headers,
		body: JSON.stringify({ document_id: documentId }),
	});

	if (!response.ok) {
		await handleApiError(response, "Get document panels");
	}

	const result = (await response.json()) as unknown;

	if (result && typeof result === "object") {
		const resultObj = result as Record<string, unknown>;

		if (resultObj.panels && typeof resultObj.panels === "object") {
			return { [documentId]: resultObj.panels as PanelsByPanelId };
		}
		if (resultObj.document_panels && typeof resultObj.document_panels === "object") {
			return { [documentId]: resultObj.document_panels as PanelsByPanelId };
		}

		if (Array.isArray(resultObj)) {
			const panelsByPanelId: PanelsByPanelId = {};
			for (const panel of resultObj) {
				if (panel && typeof panel === "object" && "id" in panel) {
					const p = panel as { id: string; original_content?: string; content?: unknown };
					panelsByPanelId[p.id] = {
						original_content: p.original_content || "",
						content: p.content as DocumentStructure | undefined,
					};
				}
			}
			return { [documentId]: panelsByPanelId };
		}

		if (Object.keys(resultObj).length > 0) {
			return { [documentId]: resultObj as PanelsByPanelId };
		}
	}

	return null;
}

export async function getDocumentBatch(documentIds: string[]): Promise<Document[]> {
	const headers = await createHeaders();
	const response = await fetch(`${API_CONFIG.API_URL}/get-documents-batch`, {
		method: "POST",
		headers,
		body: JSON.stringify({ document_ids: documentIds }),
	});

	if (!response.ok) {
		await handleApiError(response, "Get documents batch");
	}

	const result = (await response.json()) as { docs?: Document[] };
	return Array.isArray(result?.docs) ? result.docs : [];
}

// Re-export the markdown converter for use in tool handlers
export { convertDocumentToMarkdown };

export function getPanelId(panels: Record<string, unknown>, docId: string): string | undefined {
	if (!panels || !panels[docId]) return undefined;
	const panel = panels[docId];
	if (typeof panel !== "object" || panel === null) return undefined;
	const keys = Object.keys(panel);
	return keys.length > 0 ? keys[0] : undefined;
}
