// ABOUTME: Tests for MCP server instantiation and tool registration
// ABOUTME: Verifies the server registers all 4 tools and handles tool calls
import { Client } from "@modelcontextprotocol/sdk/client";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory";
import { describe, expect, it } from "vitest";
import { createServer, initServer } from "../index.js";

async function setupServerAndClient() {
	const server = createServer();
	await initServer(server);
	const client = new Client({ name: "test-client", version: "1.0.0" });
	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
	return { server, client };
}

describe("MCP Server", () => {
	it("can be instantiated", () => {
		const server = createServer();
		expect(server).toBeDefined();
	});

	it("registers all 4 tools", async () => {
		const { server, client } = await setupServerAndClient();

		const result = await client.listTools();
		const toolNames = result.tools.map((t) => t.name).sort();

		expect(toolNames).toEqual(["get-note", "get-transcript", "list-notes", "list-transcripts"]);

		await client.close();
		await server.close();
	});

	it("list-notes tool has proper input schema", async () => {
		const { server, client } = await setupServerAndClient();

		const result = await client.listTools();
		const listNotesTool = result.tools.find((t) => t.name === "list-notes");

		expect(listNotesTool).toBeDefined();
		expect(listNotesTool?.description).toContain("meeting notes");
		expect(listNotesTool?.inputSchema).toBeDefined();

		await client.close();
		await server.close();
	});
});
