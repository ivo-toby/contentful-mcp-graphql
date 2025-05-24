import { beforeAll, expect } from "vitest"
import dotenv from "dotenv"

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

export { expect }
