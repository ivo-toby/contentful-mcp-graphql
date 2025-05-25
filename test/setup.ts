import { beforeAll, afterAll, afterEach, beforeEach, expect } from "vitest"
import dotenv from "dotenv"
import { setupServer } from "msw/node"
import { handlers } from "./msw-handlers"
import { initializeTestCache, cleanupTestCache } from "./unit/mocks/cache-init"
import { setupFetchSpy, resetFetchSpy } from "./unit/mocks/fetch-spy"
import { clearCache } from "../src/handlers/graphql-handlers"

// Load environment variables from .env file
dotenv.config()

// Make sure we have the required environment variables for tests
// For tests, we'll set these programmatically so we don't require them in setup
beforeAll(() => {
  // Set default test environment variables if not present
  if (!process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN) {
    process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
  }
  if (!process.env.SPACE_ID) {
    process.env.SPACE_ID = "test-space-id"
  }
  if (!process.env.ENVIRONMENT_ID) {
    process.env.ENVIRONMENT_ID = "master"
  }
})

const server = setupServer(...handlers)

// Start MSW server before tests
beforeAll(() => {
  // Initialize MSW
  server.listen({ onUnhandledRequest: "warn" })
})

beforeEach(() => {
  // Clear cache and re-initialize
  clearCache()
  initializeTestCache()

  // Set up fetch spy
  setupFetchSpy()
})

afterEach(() => {
  // Reset handlers
  server.resetHandlers()

  // Reset fetch spy
  resetFetchSpy()

  // Clear cache
  clearCache()
})

afterAll(() => {
  server.close()
  cleanupTestCache()
})

// Add custom matcher for error responses
expect.extend({
  toBeErrorResponse(received, message) {
    const pass =
      received.isError === true &&
      received.content &&
      received.content[0] &&
      received.content[0].text.includes(message)

    if (pass) {
      return {
        message: () => `expected ${received} not to be an error response containing "${message}"`,
        pass: true,
      }
    } else {
      return {
        message: () => `expected ${received} to be an error response containing "${message}"`,
        pass: false,
      }
    }
  },
})

export { expect }
