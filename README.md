# granola-mcp

MCP server that gives AI assistants access to your [Granola](https://granola.ai) meeting notes and transcripts.

Works with any MCP-compatible client: [Claude Code](https://docs.anthropic.com/en/docs/claude-code), [Claude Desktop](https://claude.ai/download), etc.

## Prerequisites

- **Node.js** >= 18
- **Granola desktop app** installed, running, and logged in (the server reads your local auth token)

## Setup

```bash
git clone https://github.com/bhandzo/granola-mcp.git
cd granola-mcp
npm install
npm run build
```

### Add to Claude Code

```bash
claude mcp add granola-mcp node /absolute/path/to/granola-mcp/dist/index.js
```

### Add to Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "granola": {
      "command": "node",
      "args": ["/absolute/path/to/granola-mcp/dist/index.js"]
    }
  }
}
```

## Tools

### `list-notes`

List your Granola meeting notes with optional date filtering.

| Parameter   | Type   | Required | Description |
|-------------|--------|----------|-------------|
| `date`      | string | no       | Single date (`YYYY-MM-DD`) or relative: `today`, `yesterday`, `last week`, `last month` |
| `startDate` | string | no       | Start of date range (`YYYY-MM-DD`) |
| `endDate`   | string | no       | End of date range (`YYYY-MM-DD`) |
| `limit`     | number | no       | Max results (default: 25) |

Returns a JSON array of `{ id, title, date }` objects, sorted by date descending.

### `list-transcripts`

List meetings that have transcripts. Same parameters and output shape as `list-notes`. Use `get-transcript` to fetch the actual transcript content.

### `get-note`

Get the full content of a Granola note by ID.

| Parameter     | Type   | Required | Description |
|---------------|--------|----------|-------------|
| `noteId`      | string | **yes**  | The document ID (from `list-notes`) |
| `contentType` | string | no       | `enhanced` (AI panels), `original` (your notes), or `auto` (best available, default) |
| `path`        | string | no       | File path to write output to. If omitted, returns content inline. |

**Inline mode** (no `path`): Returns the full note as markdown text.

**File mode** (`path` provided): Writes a markdown file with YAML frontmatter and returns a short confirmation. This saves context window space for large notes.

```markdown
---
title: "Weekly Standup"
date: "2025-01-15T10:00:00.000Z"
id: "abc123"
type: note
---

Meeting content here...
```

### `get-transcript`

Get the full transcript of a meeting by document ID.

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `noteId`  | string | **yes**  | The document ID (from `list-notes` or `list-transcripts`) |
| `path`    | string | no       | File path to write output to. If omitted, returns content inline. |

**Inline mode**: Returns the transcript as markdown with speaker labels (`**Me:**`, `**System:**`).

**File mode**: Same YAML frontmatter format as `get-note`, with `type: transcript`.

## How authentication works

The server reads your Granola auth token from the local config file that the Granola desktop app writes:

- **macOS**: `~/Library/Application Support/Granola/supabase.json`
- **Windows**: `%APPDATA%/Granola/supabase.json`

No API keys or environment variables needed. If Granola is installed and you're logged in, it just works.

## Development

```bash
npm test          # run tests (hits live Granola API)
npm run test:watch # run tests in watch mode
npm run lint       # check formatting and lint rules
npm run lint:fix   # auto-fix lint issues
npm run typecheck  # type check without emitting
npm run build      # compile TypeScript to dist/
```

### Project structure

```
src/
  index.ts              # MCP server entry point, tool registration
  api.ts                # Granola API client (auth, fetch, markdown conversion)
  types.ts              # Shared TypeScript types
  tools/
    list-notes.ts       # list-notes handler
    list-transcripts.ts # list-transcripts handler
    get-note.ts         # get-note handler
    get-transcript.ts   # get-transcript handler
  __tests__/
    api.test.ts         # API client tests
    tools.test.ts       # Tool handler tests
    server.test.ts      # MCP server registration tests
```

## License

MIT
