import { describe, it, expect } from "vitest"
import { getOptionalEnvProperties, getGraphQLTools, getTools } from "../../src/types/tools"

describe("tools configuration", () => {
  describe("getOptionalEnvProperties", () => {
    it("adds optional environment properties to a config schema", () => {
      const baseConfig = {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query to execute",
          },
        },
        required: ["query"],
      }

      const result = getOptionalEnvProperties(baseConfig)

      expect(result).toEqual({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The query to execute",
          },
          spaceId: {
            type: "string",
            description:
              "Optional override for the space ID (defaults to SPACE_ID environment variable)",
          },
          environmentId: {
            type: "string",
            description:
              "Optional override for the environment ID (defaults to ENVIRONMENT_ID environment variable or 'master')",
          },
        },
        required: ["query"],
      })
    })

    it("preserves existing properties and required fields", () => {
      const baseConfig = {
        type: "object",
        properties: {
          contentType: {
            type: "string",
            description: "Content type name",
          },
          includeRelations: {
            type: "boolean",
            description: "Include relations",
          },
        },
        required: ["contentType"],
      }

      const result = getOptionalEnvProperties(baseConfig)

      expect(result.properties).toHaveProperty("contentType")
      expect(result.properties).toHaveProperty("includeRelations")
      expect(result.properties).toHaveProperty("spaceId")
      expect(result.properties).toHaveProperty("environmentId")
      expect(result.required).toEqual(["contentType"])
    })

    it("handles config without required fields", () => {
      const baseConfig = {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "Result limit",
          },
        },
      }

      const result = getOptionalEnvProperties(baseConfig)

      expect(result.required).toEqual([])
      expect(result.properties).toHaveProperty("spaceId")
      expect(result.properties).toHaveProperty("environmentId")
    })

    it("preserves additional config properties", () => {
      const baseConfig = {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: true,
        customField: "customValue",
      }

      const result = getOptionalEnvProperties(baseConfig)

      expect(result.additionalProperties).toBe(true)
      expect(result.customField).toBe("customValue")
    })
  })

  describe("getGraphQLTools", () => {
    it("returns all GraphQL tool definitions", () => {
      const tools = getGraphQLTools()

      expect(tools).toHaveProperty("GRAPHQL_LIST_CONTENT_TYPES")
      expect(tools).toHaveProperty("GRAPHQL_GET_CONTENT_TYPE_SCHEMA")
      expect(tools).toHaveProperty("GRAPHQL_GET_EXAMPLE")
      expect(tools).toHaveProperty("GRAPHQL_QUERY")
      expect(tools).toHaveProperty("SMART_SEARCH")
      expect(tools).toHaveProperty("BUILD_SEARCH_QUERY")
    })

    it("has correct tool structure for GRAPHQL_LIST_CONTENT_TYPES", () => {
      const tools = getGraphQLTools()
      const tool = tools.GRAPHQL_LIST_CONTENT_TYPES

      expect(tool.name).toBe("graphql_list_content_types")
      expect(tool.description).toContain("IMPORTANT: Use this tool FIRST")
      expect(tool.inputSchema.type).toBe("object")
      expect(tool.inputSchema.properties).toHaveProperty("spaceId")
      expect(tool.inputSchema.properties).toHaveProperty("environmentId")
      expect(tool.inputSchema.required).toEqual([])
    })

    it("has correct tool structure for GRAPHQL_GET_CONTENT_TYPE_SCHEMA", () => {
      const tools = getGraphQLTools()
      const tool = tools.GRAPHQL_GET_CONTENT_TYPE_SCHEMA

      expect(tool.name).toBe("graphql_get_content_type_schema")
      expect(tool.description).toContain("IMPORTANT: Use this tool AFTER")
      expect(tool.inputSchema.properties).toHaveProperty("contentType")
      expect(tool.inputSchema.required).toContain("contentType")
    })

    it("has correct tool structure for GRAPHQL_QUERY", () => {
      const tools = getGraphQLTools()
      const tool = tools.GRAPHQL_QUERY

      expect(tool.name).toBe("graphql_query")
      expect(tool.description).toContain("IMPORTANT: Before using this tool")
      expect(tool.inputSchema.properties).toHaveProperty("query")
      expect(tool.inputSchema.properties).toHaveProperty("variables")
      expect(tool.inputSchema.required).toContain("query")
    })

    it("has correct tool structure for SMART_SEARCH", () => {
      const tools = getGraphQLTools()
      const tool = tools.SMART_SEARCH

      expect(tool.name).toBe("smart_search")
      expect(tool.description).toContain("intelligent search")
      expect(tool.inputSchema.properties).toHaveProperty("query")
      expect(tool.inputSchema.properties).toHaveProperty("contentTypes")
      expect(tool.inputSchema.properties).toHaveProperty("limit")
      expect(tool.inputSchema.required).toContain("query")
    })

    it("has correct tool structure for BUILD_SEARCH_QUERY", () => {
      const tools = getGraphQLTools()
      const tool = tools.BUILD_SEARCH_QUERY

      expect(tool.name).toBe("build_search_query")
      expect(tool.description).toContain("Generate a GraphQL search query")
      expect(tool.inputSchema.properties).toHaveProperty("contentType")
      expect(tool.inputSchema.properties).toHaveProperty("searchTerm")
      expect(tool.inputSchema.properties).toHaveProperty("fields")
      expect(tool.inputSchema.required).toEqual(["contentType", "searchTerm"])
    })

    it("includes environment override properties in all tools", () => {
      const tools = getGraphQLTools()

      Object.values(tools).forEach((tool) => {
        expect(tool.inputSchema.properties).toHaveProperty("spaceId")
        expect(tool.inputSchema.properties).toHaveProperty("environmentId")
        expect(tool.inputSchema.properties.spaceId.description).toContain("Optional override")
        expect(tool.inputSchema.properties.environmentId.description).toContain("Optional override")
      })
    })
  })

  describe("getTools", () => {
    it("returns all tools including GraphQL tools", () => {
      const tools = getTools()
      const graphqlTools = getGraphQLTools()

      expect(tools).toEqual(graphqlTools)
    })

    it("has all expected tool names", () => {
      const tools = getTools()
      const toolNames = Object.keys(tools)

      expect(toolNames).toContain("GRAPHQL_LIST_CONTENT_TYPES")
      expect(toolNames).toContain("GRAPHQL_GET_CONTENT_TYPE_SCHEMA")
      expect(toolNames).toContain("GRAPHQL_GET_EXAMPLE")
      expect(toolNames).toContain("GRAPHQL_QUERY")
      expect(toolNames).toContain("SMART_SEARCH")
      expect(toolNames).toContain("BUILD_SEARCH_QUERY")
    })
  })
})
