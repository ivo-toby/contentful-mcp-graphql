import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  graphqlHandlers,
  // loadContentfulMetadata, // We will mock cache functions directly
  clearCache, // Still useful for ensuring clean state if real cache was ever populated
} from "../../src/handlers/graphql-handlers.js"

// Mock undici fetch - still needed for direct executeQuery calls made by smartSearch
const mockFetch = vi.hoisted(() => vi.fn())
vi.mock("undici", () => ({
  fetch: mockFetch,
}))

// Mock parts of the graphql-handlers module for cache control
const mockGetCachedContentTypes = vi.hoisted(() => vi.fn())
const mockGetCachedContentTypeSchema = vi.hoisted(() => vi.fn())
const mockIsCacheAvailable = vi.hoisted(() => vi.fn())

vi.mock("../../src/handlers/graphql-handlers.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/handlers/graphql-handlers.js")>(
    "../../src/handlers/graphql-handlers.js",
  )
  return {
    ...actual, // Spread actual module exports first
    // THEN override with our mocks for standalone functions
    isCacheAvailable: mockIsCacheAvailable,
    getCachedContentTypes: mockGetCachedContentTypes,
    getCachedContentTypeSchema: mockGetCachedContentTypeSchema,
    // clearCache will be from actual unless we also mock it here
  }
})

describe("Smart Search", () => {
  beforeEach(() => {
    vi.clearAllMocks() // Clears mockFetch, mockGetCachedContentTypes, etc.
    clearCache() // If there was any real cache, clear it.

    // Default mock states for cache
    mockIsCacheAvailable.mockReturnValue(true) // Assume cache is available for most tests
    mockGetCachedContentTypes.mockReturnValue(null) // Default to no content types
    mockGetCachedContentTypeSchema.mockReturnValue(null) // Default to no specific schema

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
          {
            name: "internalName",
            description: "Internal name",
            type: { kind: "SCALAR", name: "String" },
          },
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

  const mockContentTypesData = [
    { name: "pageArticle", queryName: "pageArticleCollection", description: "Page articles" },
    {
      name: "topicCategory",
      queryName: "topicCategoryCollection",
      description: "Topic categories",
    },
  ]

  const mockPageArticleSchemaData = {
    contentType: "PageArticle",
    description: "Page Article content type",
    fields: [
      { name: "sys", type: "Sys!", description: "System fields" },
      { name: "title", type: "String", description: "Title field" },
      { name: "internalName", type: "String", description: "Internal name" },
      { name: "slug", type: "String", description: "URL slug" },
    ],
  }

  const mockTopicCategorySchemaData = {
    contentType: "TopicCategory",
    description: "Topic Category content type",
    fields: [
      { name: "sys", type: "Sys!", description: "System fields" },
      { name: "name", type: "String", description: "Category name" },
      { name: "description", type: "String", description: "Category description" },
    ],
  }

  it("should perform smart search across multiple content types", async () => {
    mockGetCachedContentTypes.mockReturnValue(mockContentTypesData)
    mockGetCachedContentTypeSchema.mockImplementation((contentType: string) => {
      if (contentType === "pageArticle") return mockPageArticleSchemaData
      if (contentType === "topicCategory") return mockTopicCategorySchemaData
      return null
    })

    const mockSearchResponse1 = {
      data: {
        pageArticleCollection: {
          items: [
            {
              sys: { id: "1" },
              title: "How do I update my address?",
              internalName: "Update address guide",
              slug: "update-address",
            },
          ],
        },
      },
    }
    const mockSearchResponse2 = {
      data: {
        topicCategoryCollection: {
          items: [], // No results for topicCategory
        },
      },
    }

    mockFetch
      .mockResolvedValueOnce({
        // For PageArticle search
        ok: true,
        json: async () => mockSearchResponse1,
      })
      .mockResolvedValueOnce({
        // For TopicCategory search
        ok: true,
        json: async () => mockSearchResponse2,
      })

    const result = await graphqlHandlers.smartSearch({
      query: "address",
      limit: 5,
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)

    expect(response.query).toBe("address")
    expect(response.results).toHaveLength(1)
    expect(response.results[0].contentType).toBe("pageArticle")
    expect(response.results[0].items[0].title).toBe("How do I update my address?")
    expect(response.totalContentTypesSearched).toBe(2)
    expect(response.contentTypesWithResults).toBe(1)
    expect(mockFetch).toHaveBeenCalledTimes(2) // One for PageArticle, one for TopicCategory
  })

  it("should filter content types when specified", async () => {
    mockGetCachedContentTypes.mockReturnValue(mockContentTypesData) // Provide all types
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchemaData) // Only PageArticle schema needed

    mockFetch.mockResolvedValueOnce({
      // For the single search on PageArticle
      ok: true,
      json: async () => ({
        data: {
          pageArticleCollection: {
            items: [{ sys: { id: "pa1" }, title: "Test Article" }],
          },
        },
      }),
    })

    const result = await graphqlHandlers.smartSearch({
      query: "test",
      contentTypes: ["pageArticle"],
      limit: 3,
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.totalContentTypesSearched).toBe(1)
    expect(response.results).toHaveLength(1)
    expect(response.results[0].contentType).toBe("pageArticle")
    expect(mockFetch).toHaveBeenCalledTimes(1) // Only one search call
  })

  it("should handle cache not available", async () => {
    mockIsCacheAvailable.mockReturnValue(false) // Explicitly set cache as unavailable
    const result = await graphqlHandlers.smartSearch({
      query: "test",
    })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Smart search requires cached metadata")
  })

  it("should handle missing environment variables", async () => {
    mockIsCacheAvailable.mockReturnValue(true) // Ensure cache is considered available
    mockGetCachedContentTypes.mockReturnValue(mockContentTypesData) // Provide some data for cache
    vi.stubEnv("CONTENTFUL_DELIVERY_ACCESS_TOKEN", "")
    const result = await graphqlHandlers.smartSearch({
      query: "test",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Space ID and CDA token are required")
  })

  it("should skip content types with no searchable fields", async () => {
    const assetSchemaNoText = {
      contentType: "Asset",
      description: "Asset content type",
      fields: [
        { name: "sys", type: "Sys!", description: "System fields" },
        { name: "width", type: "Int", description: "Width" },
      ],
    }
    mockGetCachedContentTypes.mockReturnValue([
      { name: "asset", queryName: "assetCollection", description: "Assets" },
      { name: "pageArticle", queryName: "pageArticleCollection", description: "Page articles" },
    ])
    mockGetCachedContentTypeSchema.mockImplementation((ct: string) => {
      if (ct === "asset") return assetSchemaNoText
      if (ct === "pageArticle") return mockPageArticleSchemaData
      return null
    })

    // Mock the search call for PageArticle (Asset will be skipped)
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { pageArticleCollection: { items: [] } } }),
    })

    const result = await graphqlHandlers.smartSearch({
      query: "test",
      contentTypes: ["asset", "pageArticle"], // Explicitly include asset
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    // Expecting 0 results because Asset has no searchable fields and we don't mock PageArticle search here
    expect(response.results).toHaveLength(0)

    // 1 call for PageArticle search. Asset search is skipped.
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("should handle GraphQL errors gracefully", async () => {
    mockGetCachedContentTypes.mockReturnValue(mockContentTypesData)
    mockGetCachedContentTypeSchema.mockImplementation((contentType: string) => {
      if (contentType === "pageArticle") return mockPageArticleSchemaData
      if (contentType === "topicCategory") return mockTopicCategorySchemaData
      return null
    })

    // Mock GraphQL error for PageArticle, success for TopicCategory
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'Field "title_contains" is not defined' }] }),
    })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { topicCategoryCollection: { items: [] } } }),
    })

    const result = await graphqlHandlers.smartSearch({
      query: "test", // Searches both PageArticle and TopicCategory by default
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.results).toHaveLength(0) // No items should be returned due to error/empty
    expect(response.contentTypesWithResults).toBe(0)
    expect(mockFetch).toHaveBeenCalledTimes(2) // One for each content type attempt
  })
})
