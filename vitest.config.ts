// ABOUTME: Vitest configuration for granola-mcp tests
// ABOUTME: Uses real API calls (no mocks), with extended timeout for network requests
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		testTimeout: 30000,
		hookTimeout: 30000,
	},
});
