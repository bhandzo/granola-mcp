// ABOUTME: MCP server entry point for Granola meeting notes and transcripts
// ABOUTME: Registers 4 tools (list-notes, list-transcripts, get-note, get-transcript) via stdio transport
import { Server } from "@modelcontextprotocol/sdk/server";
import { getNote } from "./tools/get-note.js";
import { getTranscriptTool } from "./tools/get-transcript.js";
import { listNotes } from "./tools/list-notes.js";
import { listTranscripts } from "./tools/list-transcripts.js";

// The SDK's wildcard exports ("./*") are broken for Node ESM resolution
// (missing .js extension in the resolved path). We use dynamic imports
// for subpaths that rely on the wildcard, and define schema references
// that match what setRequestHandler expects.

const TOOL_DEFINITIONS = [
	{
		name: "list-notes",
		description: "List Granola meeting notes with optional date filtering.",
		inputSchema: {
			type: "object" as const,
			properties: {
				date: {
					type: "string",
					description: "Single date (YYYY-MM-DD) or relative: 'today', 'yesterday', 'last week', 'last month'",
				},
				startDate: {
					type: "string",
					description: "Start of date range (YYYY-MM-DD)",
				},
				endDate: {
					type: "string",
					description: "End of date range (YYYY-MM-DD)",
				},
				limit: {
					type: "number",
					description: "Max results to return (default: 25)",
				},
			},
		},
	},
	{
		name: "list-transcripts",
		description:
			"List Granola meetings that have transcripts, with optional date filtering. Use get-transcript to fetch actual transcript content.",
		inputSchema: {
			type: "object" as const,
			properties: {
				date: {
					type: "string",
					description: "Single date (YYYY-MM-DD) or relative: 'today', 'yesterday', 'last week', 'last month'",
				},
				startDate: {
					type: "string",
					description: "Start of date range (YYYY-MM-DD)",
				},
				endDate: {
					type: "string",
					description: "End of date range (YYYY-MM-DD)",
				},
				limit: {
					type: "number",
					description: "Max results to return (default: 25)",
				},
			},
		},
	},
	{
		name: "get-note",
		description: "Get the full content of a specific Granola note by ID.",
		inputSchema: {
			type: "object" as const,
			properties: {
				noteId: {
					type: "string",
					description: "The document ID of the note",
				},
				contentType: {
					type: "string",
					enum: ["enhanced", "original", "auto"],
					description:
						"'enhanced' for AI-generated panels, 'original' for user notes, 'auto' to pick best available (default: auto)",
				},
			},
			required: ["noteId"],
		},
	},
	{
		name: "get-transcript",
		description: "Get the full transcript of a specific Granola meeting by document ID.",
		inputSchema: {
			type: "object" as const,
			properties: {
				noteId: {
					type: "string",
					description: "The document ID to get transcript for",
				},
			},
			required: ["noteId"],
		},
	},
];

async function loadSdkSchemas() {
	// Dynamic import to work around the SDK's broken wildcard exports
	const typesPath = new URL("../node_modules/@modelcontextprotocol/sdk/dist/esm/types.js", import.meta.url).href;
	const types = await import(typesPath);
	return {
		ListToolsRequestSchema: types.ListToolsRequestSchema,
		CallToolRequestSchema: types.CallToolRequestSchema,
	};
}

async function loadStdioTransport() {
	const stdioPath = new URL("../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js", import.meta.url).href;
	const stdio = await import(stdioPath);
	return stdio.StdioServerTransport;
}

export function createServer(): Server {
	return createServerSync();
}

function createServerSync(): Server {
	const server = new Server({ name: "granola", version: "1.0.0" }, { capabilities: { tools: {} } });
	// We'll register handlers lazily in startServer, or eagerly in tests via initServer
	return server;
}

export async function initServer(server: Server): Promise<void> {
	const { ListToolsRequestSchema, CallToolRequestSchema } = await loadSdkSchemas();

	server.setRequestHandler(ListToolsRequestSchema, async () => {
		return { tools: TOOL_DEFINITIONS };
	});

	server.setRequestHandler(
		CallToolRequestSchema,
		async (request: { params: { name: string; arguments?: Record<string, unknown> } }) => {
			const { name, arguments: args } = request.params;
			const input = (args ?? {}) as Record<string, unknown>;

			try {
				switch (name) {
					case "list-notes": {
						const result = await listNotes({
							date: input.date as string | undefined,
							startDate: input.startDate as string | undefined,
							endDate: input.endDate as string | undefined,
							limit: input.limit as number | undefined,
						});
						return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
					}
					case "list-transcripts": {
						const result = await listTranscripts({
							date: input.date as string | undefined,
							startDate: input.startDate as string | undefined,
							endDate: input.endDate as string | undefined,
							limit: input.limit as number | undefined,
						});
						return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
					}
					case "get-note": {
						const result = await getNote({
							noteId: input.noteId as string,
							contentType: input.contentType as "enhanced" | "original" | "auto" | undefined,
						});
						return { content: [{ type: "text", text: result }] };
					}
					case "get-transcript": {
						const result = await getTranscriptTool({
							noteId: input.noteId as string,
						});
						return { content: [{ type: "text", text: result }] };
					}
					default:
						return {
							content: [{ type: "text", text: `Unknown tool: ${name}` }],
							isError: true,
						};
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `Error: ${message}` }],
					isError: true,
				};
			}
		},
	);
}

// Start the server when run directly
const isDirectRun = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isDirectRun) {
	(async () => {
		const server = createServer();
		await initServer(server);
		const StdioServerTransport = await loadStdioTransport();
		const transport = new StdioServerTransport();
		await server.connect(transport);
	})().catch((err) => {
		console.error("Failed to start server:", err);
		process.exit(1);
	});
}
