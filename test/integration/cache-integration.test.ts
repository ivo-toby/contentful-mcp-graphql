import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  loadContentfulMetadata,
  graphqlHandlers,
  getCacheStatus,
  isCacheAvailable,
  clearCache,
} from "../../src/handlers/graphql-handlers.js"

// Mock fetch for integration tests
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("Integration: Caching + Smart Search", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear cache state
    clearCache()
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
          {
            name: "internalName",
            description: "Internal name",
            type: { kind: "SCALAR", name: "String" },
          },
          { name: "slug", description: "Slug field", type: { kind: "SCALAR", name: "String" } },
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
          { name: "name", description: "Name field", type: { kind: "SCALAR", name: "String" } },
          {
            name: "description",
            description: "Description field",
            type: { kind: "SCALAR", name: "String" },
          },
        ],
      },
    },
  }

  it("should load cache and then perform smart search", async () => {
    // Step 1: Load cache
    mockFetch
      // Content types request
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse,
      })
      // Schema requests
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopicCategorySchema,
      })

    await loadContentfulMetadata("test-space", "master", "test-token")

    // Verify cache is loaded
    expect(isCacheAvailable()).toBe(true)
    const cacheStatus = getCacheStatus()
    expect(cacheStatus.available).toBe(true)
    expect(cacheStatus.contentTypesCount).toBe(2)
    expect(cacheStatus.schemasCount).toBe(2)

    // Step 2: Perform smart search using cached data
    const mockSearchResult1 = {
      data: {
        pageArticleCollection: {
          items: [
            {
              sys: { id: "article-1" },
              title: "How do I update my address?",
              internalName: "Address Update Guide",
              slug: "update-address",
            },
          ],
        },
      },
    }

    const mockSearchResult2 = {
      data: {
        topicCategoryCollection: {
          items: [
            {
              sys: { id: "category-1" },
              name: "Account Management",
              description: "Topics about managing your account and personal information",
            },
          ],
        },
      },
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResult1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResult2,
      })

    const searchResult = await graphqlHandlers.smartSearch({
      query: "address",
      limit: 5,
    })

    expect(searchResult.isError).toBeFalsy()
    const response = JSON.parse(searchResult.content[0].text)

    expect(response.query).toBe("address")
    expect(response.results).toHaveLength(2)

    // Check pageArticle result
    const pageArticleResult = response.results.find((r: any) => r.contentType === "pageArticle")
    expect(pageArticleResult).toBeDefined()
    expect(pageArticleResult.items[0].title).toBe("How do I update my address?")

    // Check topicCategory result
    const topicCategoryResult = response.results.find((r: any) => r.contentType === "topicCategory")
    expect(topicCategoryResult).toBeDefined()
    expect(topicCategoryResult.items[0].name).toBe("Account Management")

    expect(response.totalContentTypesSearched).toBe(2)
    expect(response.contentTypesWithResults).toBe(2)
  })

  it("should build search query using cached schema", async () => {
    // Load cache first
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

    // Now build search query
    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "pageArticle",
      searchTerm: "address",
    })

    expect(result.isError).toBeFalsy()
    const queryText = result.content[0].text

    // Should generate a proper search query
    expect(queryText).toContain("query SearchPageArticle($searchTerm: String!)")
    expect(queryText).toContain("pageArticleCollection(where: { OR: [")
    expect(queryText).toContain("{ title_contains: $searchTerm }")
    expect(queryText).toContain("{ internalName_contains: $searchTerm }")
    expect(queryText).toContain("{ slug_contains: $searchTerm }")
    expect(queryText).toContain('"searchTerm": "address"')

    // Should list the searchable fields used
    expect(queryText).toContain("- title (String)")
    expect(queryText).toContain("- internalName (String)")
    expect(queryText).toContain("- slug (String)")
  })

  it("should use cached data for listContentTypes and getContentTypeSchema", async () => {
    // Load cache
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

    // Clear fetch mock to ensure subsequent calls use cache
    vi.clearAllMocks()

    // Test listContentTypes uses cache
    const contentTypesResult = await graphqlHandlers.listContentTypes({})
    expect(contentTypesResult.isError).toBeFalsy()
    const contentTypesResponse = JSON.parse(contentTypesResult.content[0].text)
    expect(contentTypesResponse.cached).toBe(true)
    expect(contentTypesResponse.contentTypes).toHaveLength(2)
    expect(mockFetch).not.toHaveBeenCalled()

    // Test getContentTypeSchema uses cache
    const schemaResult = await graphqlHandlers.getContentTypeSchema({
      contentType: "pageArticle",
    })
    expect(schemaResult.isError).toBeFalsy()
    const schemaResponse = JSON.parse(schemaResult.content[0].text)
    expect(schemaResponse.cached).toBe(true)
    expect(schemaResponse.contentType).toBe("PageArticle")
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
