import { expect, vi, describe, it, beforeEach, afterEach } from "vitest"
import { getAllTools } from "../../src/index.js"
import { graphqlHandlers } from "../../src/handlers/graphql-handlers.js"

// Mock the validation module to prevent process.exit
vi.mock("../../src/utils/validation.js", () => ({
  validateEnvironment: vi.fn(),
}))

// Mock tools module
vi.mock("../../src/types/tools.js", () => {
  const getTools = () => ({
    GRAPHQL_QUERY: { name: "graphql_query", description: "GraphQL query tool" },
    GRAPHQL_LIST_CONTENT_TYPES: {
      name: "graphql_list_content_types",
      description: "List content types tool",
    },
    GRAPHQL_GET_CONTENT_TYPE_SCHEMA: {
      name: "graphql_get_content_type_schema",
      description: "Get content type schema tool",
    },
    GRAPHQL_GET_EXAMPLE: { name: "graphql_get_example", description: "Get GraphQL example tool" },
  })

  return {
    getTools,
    getGraphQLTools: vi.fn(),
    getSpaceEnvProperties: vi.fn(),
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

      // Get the tools
      const tools = getAllTools()

      // Verify only GraphQL tools are available
      expect(tools).to.be.an("object")
      // Should have 4 GraphQL tools
      expect(Object.keys(tools)).to.have.length.at.most(4)
      expect(tools).to.have.property("GRAPHQL_QUERY")
      expect(tools).to.have.property("GRAPHQL_LIST_CONTENT_TYPES")
      expect(tools).to.have.property("GRAPHQL_GET_CONTENT_TYPE_SCHEMA")
      expect(tools).to.have.property("GRAPHQL_GET_EXAMPLE")
      expect(tools).to.not.have.property("CREATE_ENTRY")
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

    it("should use argument cdaToken over environment token", async () => {
      // Import the mocked fetch
      const { fetch } = await import("undici")

      // Set up mock environment
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "env-cda-token"

      // Execute a GraphQL query with explicit cdaToken
      await graphqlHandlers.executeQuery({
        spaceId: "test-space",
        environmentId: "master",
        query: "{ test { field } }",
        cdaToken: "arg-cda-token",
      })

      // Verify the argument CDA token was used
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("test-space"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer arg-cda-token",
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

  describe("Required Parameters", () => {
    it("should require spaceId parameter for listContentTypes", async () => {
      const result = await graphqlHandlers.listContentTypes({
        spaceId: "",
        cdaToken: "test-token",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require cdaToken parameter for listContentTypes", async () => {
      const result = await graphqlHandlers.listContentTypes({
        spaceId: "test-space",
        cdaToken: "",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })

    it("should require spaceId parameter for getContentTypeSchema", async () => {
      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "TestType",
        spaceId: "",
        cdaToken: "test-token",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require cdaToken parameter for getContentTypeSchema", async () => {
      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "TestType",
        spaceId: "test-space",
        cdaToken: "",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })

    it("should require spaceId parameter for executeQuery", async () => {
      const result = await graphqlHandlers.executeQuery({
        query: "{ test }",
        spaceId: "",
        cdaToken: "test-token",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })

    it("should require cdaToken parameter for executeQuery", async () => {
      const result = await graphqlHandlers.executeQuery({
        query: "{ test }",
        spaceId: "test-space",
        cdaToken: "",
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Content Delivery API (CDA) token is required")
    })
  })

  describe("Parameter Validation", () => {
    it("should accept valid spaceId and cdaToken", async () => {
      // This will fail with network error, but should pass parameter validation
      const result = await graphqlHandlers.listContentTypes({
        spaceId: "valid-space-id",
        cdaToken: "valid-cda-token",
      })

      // Should not fail due to missing parameters
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Space ID is required")
        expect(result.content[0].text).not.toContain("Content Delivery API (CDA) token is required")
      }
    })

    it("should use default environment when not provided", async () => {
      // This will fail with network error, but should use default environment
      const result = await graphqlHandlers.listContentTypes({
        spaceId: "valid-space-id",
        cdaToken: "valid-cda-token",
        // environmentId not provided, should default to "master"
      })

      // Should not fail due to missing environment
      if (result.isError) {
        expect(result.content[0].text).not.toContain("Environment ID is required")
      }
    })
  })
})
