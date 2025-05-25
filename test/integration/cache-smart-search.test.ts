import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  loadContentfulMetadata,
  graphqlHandlers,
  getCacheStatus,
  isCacheAvailable,
  clearCache,
} from "../../src/handlers/graphql-handlers.js"

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

describe("Integration: Cache + Smart Search", () => {
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
        ],
      },
    },
  }

  const mockSearchResponse = {
    data: {
      pageArticleCollection: {
        items: [
          {
            sys: { id: "5PmzE2MC9Xx1M3qsuQE2C7" },
            title: "How do I update my address?",
            internalName: "How do I update my address?",
          },
        ],
      },
    },
  }

  it("should complete full workflow: load cache -> smart search", async () => {
    // Step 1: Load cache
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema,
      })

    await loadContentfulMetadata("test-space", "master", "test-token")

    // Verify cache is loaded
    expect(isCacheAvailable()).toBe(true)
    const status = getCacheStatus()
    expect(status.available).toBe(true)
    expect(status.contentTypesCount).toBe(1)
    expect(status.schemasCount).toBe(1)

    // Step 2: Perform smart search using cache
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    })

    const searchResult = await graphqlHandlers.smartSearch({
      query: "address",
      spaceId: "test-space",
      environmentId: "master",
    })

    // Verify search results
    expect(searchResult.isError).toBeFalsy()
    const response = JSON.parse(searchResult.content[0].text)

    expect(response.query).toBe("address")
    expect(response.results).toHaveLength(1)
    expect(response.results[0].contentType).toBe("pageArticle")
    expect(response.results[0].items[0].title).toBe("How do I update my address?")

    // Verify the generated query was correct
    const lastFetchCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]
    const requestBody = JSON.parse(lastFetchCall[1].body)

    expect(requestBody.query).toContain("pageArticleCollection")
    expect(requestBody.query).toContain("title_contains: $searchTerm")
    expect(requestBody.query).toContain("internalName_contains: $searchTerm")
    expect(requestBody.variables.searchTerm).toBe("address")
  })

  it("should work with query builder after cache load", async () => {
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

    await loadContentfulMetadata("test-space", "master", "test-token")

    // Use query builder
    const buildResult = await graphqlHandlers.buildSearchQuery({
      contentType: "pageArticle",
      searchTerm: "address",
    })

    expect(buildResult.isError).toBeFalsy()
    const queryText = buildResult.content[0].text

    expect(queryText).toContain("query SearchPageArticle($searchTerm: String!)")
    expect(queryText).toContain("pageArticleCollection(where: { OR: [")
    expect(queryText).toContain("{ title_contains: $searchTerm }")
    expect(queryText).toContain("{ internalName_contains: $searchTerm }")
    expect(queryText).toContain('"searchTerm": "address"')
  })

  it("should handle cache miss gracefully and fall back to API", async () => {
    // Don't load cache, so handlers should fall back to API

    // Mock API responses for listContentTypes fallback
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockContentTypesResponse,
    })

    const result = await graphqlHandlers.listContentTypes({
      spaceId: "test-space",
      environmentId: "master",
    })

    expect(result.isError).toBeFalsy()
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const response = JSON.parse(result.content[0].text)
    expect(response.cached).toBeUndefined() // Should not have cached flag
    expect(response.contentTypes).toHaveLength(1)
  })

  it("should handle partial cache loading failure", async () => {
    // Content types load successfully, but schema fails
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not Found",
      })

    await loadContentfulMetadata("test-space", "master", "test-token")

    const status = getCacheStatus()
    expect(status.contentTypesCount).toBe(1)
    expect(status.schemasCount).toBe(0) // Schema failed to load

    // Smart search should fail because no schemas are available
    const searchResult = await graphqlHandlers.smartSearch({
      query: "test",
    })

    expect(searchResult.isError).toBeFalsy()
    const response = JSON.parse(searchResult.content[0].text)
    expect(response.results).toHaveLength(0) // No results because no searchable schemas
  })

  it("should demonstrate significant performance improvement", async () => {
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

    await loadContentfulMetadata("test-space", "master", "test-token")

    // Reset fetch mock to count calls during search
    mockFetch.mockClear()

    // Mock search response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockSearchResponse,
    })

    const startTime = Date.now()
    await graphqlHandlers.smartSearch({ query: "address" })
    const endTime = Date.now()

    // Should only make 1 API call (the search itself)
    // Without cache, this would require 3 calls:
    // 1. listContentTypes
    // 2. getContentTypeSchema for pageArticle
    // 3. the actual search
    expect(mockFetch).toHaveBeenCalledTimes(1)

    // Performance should be fast (this is more of a demonstration)
    expect(endTime - startTime).toBeLessThan(1000)
  })

  it("should handle real-world scenario: find address update article", async () => {
    // This simulates the exact scenario from our conversation

    const realContentTypesResponse = {
      data: {
        __schema: {
          queryType: {
            fields: [
              {
                name: "pageArticleCollection",
                description: "Page articles",
                type: { kind: "OBJECT" },
              },
              {
                name: "topicCategoryCollection",
                description: "Categories",
                type: { kind: "OBJECT" },
              },
              { name: "assetCollection", description: "Assets", type: { kind: "OBJECT" } },
            ],
          },
        },
      },
    }

    const realPageArticleSchema = {
      data: {
        __type: {
          name: "PageArticle",
          fields: [
            { name: "sys", type: { kind: "NON_NULL", ofType: { name: "Sys" } } },
            { name: "title", type: { kind: "SCALAR", name: "String" } },
            { name: "slug", type: { kind: "SCALAR", name: "String" } },
            { name: "internalName", type: { kind: "SCALAR", name: "String" } },
          ],
        },
      },
    }

    const realSearchResponse = {
      data: {
        pageArticleCollection: {
          items: [
            {
              sys: { id: "5PmzE2MC9Xx1M3qsuQE2C7" },
              title: "How do I update my address?",
              slug: "how-do-i-update-my-address",
              internalName: "How do I update my address?",
            },
          ],
        },
      },
    }

    // Load cache
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => realContentTypesResponse })
      .mockResolvedValueOnce({ ok: true, json: async () => realPageArticleSchema })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { __type: null } }) }) // topicCategory
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { __type: null } }) }) // asset

    await loadContentfulMetadata("test-space", "master", "test-token")

    // Search for address
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => realSearchResponse })

    const result = await graphqlHandlers.smartSearch({ query: "address" })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)

    // Should find the address update article
    expect(response.results).toHaveLength(1)
    expect(response.results[0].contentType).toBe("pageArticle")
    expect(response.results[0].items[0].id).toBe("5PmzE2MC9Xx1M3qsuQE2C7")
    expect(response.results[0].items[0].title).toBe("How do I update my address?")

    // This is exactly what the user was looking for!
    expect(response.results[0].items[0].slug).toBe("how-do-i-update-my-address")
  })
})
