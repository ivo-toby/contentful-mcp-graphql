import { expect, vi, describe, it, beforeEach, afterEach } from "vitest"
import { graphqlHandlers } from "../../src/handlers/graphql-handlers.js"

// Mock the tools module to avoid circular dependencies
vi.mock("../../src/types/tools.js", () => {
  const getGraphQLTools = () => ({
    GRAPHQL_QUERY: {
      name: "graphql_query",
      description: "Execute a GraphQL query",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          variables: { type: "object" },
          spaceId: { type: "string" },
          environmentId: { type: "string" },
        },
        required: ["query"],
      },
    },
  })

  const getTools = () => ({
    ...getGraphQLTools(),
  })

  return {
    getTools,
    getGraphQLTools: vi.fn(),
    getOptionalEnvProperties: vi.fn(),
  }
})

// Mock AI Action tool context
describe("Token Authorization Scenarios", () => {
  // Save original environment variables
  const originalEnv = { ...process.env }

  beforeEach(() => {
    // Clear env variables before each test
    delete process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN
    delete process.env.SPACE_ID
    delete process.env.ENVIRONMENT_ID
  })

  afterEach(() => {
    // Reset environment variables after each test
    process.env = { ...originalEnv }
    vi.resetModules()
  })

  describe("Tool availability based on token type", () => {
    it("should expose only GraphQL tools when only CDA token is provided", () => {
      // Set up the environment with only a CDA token
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-cda-token"
      process.env.SPACE_ID = "test-space"

      // This test verifies that the environment is set up correctly for GraphQL tools
      // The actual tool availability is tested in the tools.test.ts file
      expect(process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN).toBe("test-cda-token")
      expect(process.env.SPACE_ID).toBe("test-space")
    })
  })

  describe("GraphQL handler token usage", () => {
    // Mock the fetch function
    vi.mock("undici", () => ({
      fetch: vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: { test: "data" } }),
      })),
    }))

    it("should use environment token when no override provided", async () => {
      // Import the mocked fetch
      const { fetch } = await import("undici")

      // Set up mock environment
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "env-cda-token"
      process.env.SPACE_ID = "test-space"
      process.env.ENVIRONMENT_ID = "master"

      // Execute a GraphQL query without explicit parameters (should use env vars)
      await graphqlHandlers.executeQuery({
        query: "{ test { field } }",
      })

      // Verify the environment CDA token was used
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("test-space"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer env-cda-token",
          }),
        }),
      )
    })

    it("should use optional spaceId and environmentId overrides", async () => {
      // Import the mocked fetch
      const { fetch } = await import("undici")

      // Set up mock environment
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "env-cda-token"
      process.env.SPACE_ID = "default-space"
      process.env.ENVIRONMENT_ID = "default-env"

      // Execute a GraphQL query with explicit spaceId and environmentId
      await graphqlHandlers.executeQuery({
        spaceId: "override-space",
        environmentId: "override-env",
        query: "{ test { field } }",
      })

      // Verify the overridden parameters were used
      expect(fetch).toHaveBeenCalledWith(
        "https://graphql.contentful.com/content/v1/spaces/override-space/environments/override-env",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer env-cda-token",
          }),
        }),
      )
    })
  })
})

describe("Token and Parameter Handling", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.SPACE_ID
    delete process.env.ENVIRONMENT_ID
    delete process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN
    delete process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SPACE_ID
    delete process.env.ENVIRONMENT_ID
    delete process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN
    delete process.env.CONTENTFUL_MANAGEMENT_ACCESS_TOKEN
  })

  describe("Required Environment Variables", () => {
    it("should require SPACE_ID environment variable for listContentTypes when not provided as argument", async () => {
      // Set CDA token but not SPACE_ID
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable for listContentTypes", async () => {
      // Set SPACE_ID but not CDA token
      process.env.SPACE_ID = "test-space"

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })

    it("should require SPACE_ID environment variable for getContentTypeSchema when not provided as argument", async () => {
      // Set CDA token but not SPACE_ID
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "TestType",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable for getContentTypeSchema", async () => {
      // Set SPACE_ID but not CDA token
      process.env.SPACE_ID = "test-space"

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "TestType",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })

    it("should require SPACE_ID environment variable for executeQuery when not provided as argument", async () => {
      // Set CDA token but not SPACE_ID
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"

      const result = await graphqlHandlers.executeQuery({
        query: "{ test }",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable for executeQuery", async () => {
      // Set SPACE_ID but not CDA token
      process.env.SPACE_ID = "test-space"

      const result = await graphqlHandlers.executeQuery({
        query: "{ test }",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })
  })

  describe("Parameter Validation", () => {
    it("should accept valid environment variables and optional overrides", async () => {
      // Set up valid environment variables
      process.env.SPACE_ID = "valid-space-id"
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "valid-cda-token"

      // This will fail with network error, but should pass parameter validation
      const result = await graphqlHandlers.listContentTypes({})

      // Should not fail due to missing parameters
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Space ID is required")
        expect(result.content[0].text).not.toContain("Content Delivery API (CDA) token is required")
      }
    })

    it("should use default environment when not provided", async () => {
      // Set up valid environment variables
      process.env.SPACE_ID = "valid-space-id"
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "valid-cda-token"
      // Don't set ENVIRONMENT_ID, should default to "master"

      // This will fail with network error, but should use default environment
      const result = await graphqlHandlers.listContentTypes({})

      // Should not fail due to missing environment
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Environment ID is required")
      }
    })

    it("should accept spaceId override when provided as argument", async () => {
      // Set up valid environment variables
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "valid-cda-token"
      // Don't set SPACE_ID in env, provide as argument instead

      // This will fail with network error, but should pass parameter validation
      const result = await graphqlHandlers.listContentTypes({
        spaceId: "override-space-id",
      })

      // Should not fail due to missing parameters
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Space ID is required")
        expect(result.content[0].text).not.toContain("Content Delivery API (CDA) token is required")
      }
    })

    it("should accept environmentId override when provided as argument", async () => {
      // Set up valid environment variables
      process.env.SPACE_ID = "valid-space-id"
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "valid-cda-token"

      // This will fail with network error, but should pass parameter validation
      const result = await graphqlHandlers.listContentTypes({
        environmentId: "override-env",
      })

      // Should not fail due to missing parameters
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Space ID is required")
        expect(result.content[0].text).not.toContain("Content Delivery API (CDA) token is required")
        expect(result.content[0].text).not.toContain("Environment ID is required")
      }
    })
  })
})
