import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  graphqlHandlers,
  loadContentfulMetadata,
  clearCache,
} from "../../src/handlers/graphql-handlers.js"

// Mock undici fetch
const mockFetch = vi.hoisted(() => vi.fn())
vi.mock("undici", () => ({
  fetch: mockFetch,
}))

// Mock environment variables
vi.stubEnv("SPACE_ID", "test-space")
vi.stubEnv("ENVIRONMENT_ID", "master")
vi.stubEnv("CONTENTFUL_DELIVERY_ACCESS_TOKEN", "test-token")

describe("Cached GraphQL Handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCache()
    // Reset environment variables for each test
    vi.stubEnv("SPACE_ID", "test-space")
    vi.stubEnv("ENVIRONMENT_ID", "master")
    vi.stubEnv("CONTENTFUL_DELIVERY_ACCESS_TOKEN", "test-token")
  })

  const mockContentTypesResponse = {
    data: {
      __schema: {
        queryType: {
          fields: [
            {
              name: "pageArticleCollection",
              description: "Page Article Collection",
              type: { kind: "OBJECT", ofType: { name: "PageArticleCollection", kind: "OBJECT" } },
            },
            {
              name: "topicCategoryCollection",
              description: "Topic Category Collection",
              type: { kind: "OBJECT", ofType: { name: "TopicCategoryCollection", kind: "OBJECT" } },
            },
          ],
        },
      },
    },
  }

  const mockPageArticleSchema = {
    data: {
      __type: {
        name: "PageArticle",
        description: "Page Article content type",
        fields: [
          {
            name: "sys",
            description: "System fields",
            type: { kind: "NON_NULL", ofType: { name: "Sys" } },
          },
          { name: "title", description: "Title field", type: { kind: "SCALAR", name: "String" } },
          { name: "slug", description: "URL slug", type: { kind: "SCALAR", name: "String" } },
        ],
      },
    },
  }

  const mockTopicCategorySchema = {
    data: {
      __type: {
        name: "TopicCategory",
        description: "Topic Category content type",
        fields: [
          {
            name: "sys",
            description: "System fields",
            type: { kind: "NON_NULL", ofType: { name: "Sys" } },
          },
          { name: "name", description: "Category name", type: { kind: "SCALAR", name: "String" } },
          {
            name: "description",
            description: "Category description",
            type: { kind: "SCALAR", name: "String" },
          },
        ],
      },
    },
  }

  async function setupCache() {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopicCategorySchema,
      })

    await loadContentfulMetadata("test-space", "master", "test-token")
  }

  describe("listContentTypes", () => {
    it("should return cached content types when cache is available", async () => {
      await setupCache()

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBe(true)
      expect(response.contentTypes).toHaveLength(2)
      expect(response.contentTypes[0].name).toBe("pageArticle")
      expect(response.contentTypes[0].queryName).toBe("pageArticleCollection")
      expect(response.message).toContain("from cache")
    })

    it("should fallback to API when cache is not available", async () => {
      // Don't set up cache
      const mockApiResponse = {
        data: {
          __schema: {
            queryType: {
              fields: [
                {
                  name: "pageArticleCollection",
                  description: "Page Article Collection",
                  type: {
                    kind: "OBJECT",
                    ofType: { name: "PageArticleCollection", kind: "OBJECT" },
                  },
                },
              ],
            },
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should handle missing environment variables", async () => {
      vi.stubEnv("SPACE_ID", "")

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("Space ID is required")
    })
  })

  describe("getContentTypeSchema", () => {
    it("should return cached schema when available", async () => {
      await setupCache()

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "PageArticle",
      })

      if (result.isError) {
        console.log("Error:", result.content[0].text)
      }
      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBe(true)
      expect(response.contentType).toBe("PageArticle")
      expect(response.note).toContain("from cache")
    })

    it("should try Collection suffix if not found in cache", async () => {
      // Set up cache with PageArticleCollection schema, but NOT PageArticle
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockContentTypesResponse, // Loads pageArticleCollection and topicCategoryCollection
        })
        .mockResolvedValueOnce({
          // This would be the fetch for pageArticle schema, which we want to simulate as not found initially in cache
          // So, we will let loadContentfulMetadata fetch topicCategorySchema instead for this mock slot
          ok: true,
          json: async () => mockTopicCategorySchema,
        })
        // This mock is for the PageArticleCollection schema that SHOULD be found by the fallback logic
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: {
              __type: {
                name: "PageArticleCollection",
                description: "Page Article Collection for test",
                fields: mockPageArticleSchema.data.__type.fields, // reuse fields for simplicity
              },
            },
          }),
        })

      await loadContentfulMetadata("test-space", "master", "test-token")

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "PageArticle", // Will try PageArticle first, then PageArticleCollection
      })

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.contentType).toBe("PageArticleCollection")
      expect(response.note).toContain("from cache")
    })

    it("should fallback to API when not in cache", async () => {
      // Don't set up cache
      const mockApiResponse = {
        data: {
          __type: {
            name: "PageArticle",
            description: "Page Article content type",
            fields: [
              {
                name: "title",
                description: "Title field",
                type: { kind: "SCALAR", name: "String" },
              },
            ],
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "PageArticle",
      })

      expect(result.isError).toBeFalsy()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it("should handle cache not available", async () => {
      // Don't set up cache
      const mockApiResponse = {
        data: {
          __type: {
            name: "PageArticle",
            description: "Page Article content type",
            fields: [],
          },
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse,
      })

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: "PageArticle",
      })

      expect(result.isError).toBeFalsy()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe("helper functions", () => {
    it("should correctly identify scalar types", async () => {
      // Set up cache with test schema
      const testSchema = {
        data: {
          __type: {
            name: "TestType",
            description: "Test content type",
            fields: [
              { name: "stringField", type: { kind: "SCALAR", name: "String" } },
              { name: "intField", type: { kind: "SCALAR", name: "Int" } },
              { name: "boolField", type: { kind: "SCALAR", name: "Boolean" } },
              { name: "dateField", type: { kind: "SCALAR", name: "DateTime" } },
              { name: "objectField", type: { kind: "OBJECT", name: "SomeObject" } },
            ],
          },
        },
      }

      const contentTypesWithTest = {
        data: {
          __schema: {
            queryType: {
              fields: [
                {
                  name: "testTypeCollection",
                  description: "Test Type Collection",
                  type: { kind: "OBJECT", ofType: { name: "TestTypeCollection", kind: "OBJECT" } },
                },
              ],
            },
          },
        },
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => contentTypesWithTest,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => testSchema,
        })

      await loadContentfulMetadata("test-space", "master", "test-token")

      const result = await graphqlHandlers.buildSearchQuery({
        contentType: "TestType",
        searchTerm: "test",
      })

      expect(result.isError).toBeFalsy()
      const queryText = result.content[0].text

      // Should include scalar fields in selection
      expect(queryText).toContain("stringField")
      expect(queryText).toContain("intField")
      expect(queryText).toContain("boolField")
      expect(queryText).toContain("dateField")

      // Should not include object field
      expect(queryText).not.toContain("objectField")
    })

    it("should correctly identify searchable text fields", async () => {
      // Set up cache with test schema
      const testSchema = {
        data: {
          __type: {
            name: "TestType",
            description: "Test content type",
            fields: [
              { name: "searchableText", type: { kind: "SCALAR", name: "String" } },
              { name: "requiredText", type: { kind: "NON_NULL", ofType: { name: "String" } } },
              { name: "numberField", type: { kind: "SCALAR", name: "Int" } },
              { name: "arrayField", type: { kind: "LIST", ofType: { name: "String" } } },
            ],
          },
        },
      }

      const contentTypesWithTest = {
        data: {
          __schema: {
            queryType: {
              fields: [
                {
                  name: "testTypeCollection",
                  description: "Test Type Collection",
                  type: { kind: "OBJECT", ofType: { name: "TestTypeCollection", kind: "OBJECT" } },
                },
              ],
            },
          },
        },
      }

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => contentTypesWithTest,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => testSchema,
        })

      await loadContentfulMetadata("test-space", "master", "test-token")

      const result = await graphqlHandlers.buildSearchQuery({
        contentType: "TestType",
        searchTerm: "test",
      })

      expect(result.isError).toBeFalsy()
      const queryText = result.content[0].text

      // Should include searchable text field
      expect(queryText).toContain("{ searchableText_contains: $searchTerm }")

      // Should not include required text field (has !)
      expect(queryText).not.toContain("{ requiredText_contains: $searchTerm }")

      // Should not include non-string fields
      expect(queryText).not.toContain("{ numberField_contains: $searchTerm }")
      expect(queryText).not.toContain("{ arrayField_contains: $searchTerm }")
    })
  })
})
