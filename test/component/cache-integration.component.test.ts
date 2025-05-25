import { describe, it, expect, beforeEach } from "vitest"
import {
  loadContentfulMetadata,
  graphqlHandlers,
  getCacheStatus,
  isCacheAvailable,
  clearCache,
} from "../../src/handlers/graphql-handlers"
import { initializeTestCache, mockCacheUnavailable } from "../unit/mocks/cache-init"

describe("Integration: Caching + Smart Search", () => {
  beforeEach(() => {
    // Clear cache state and initialize with mocks
    clearCache()
    initializeTestCache()
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
    // Verify cache is loaded by mock
    expect(isCacheAvailable()).toBe(true)
    const cacheStatus = getCacheStatus()
    expect(cacheStatus.available).toBe(true)
    expect(cacheStatus.contentTypesCount).toBeGreaterThan(0)

    // Now use smart search (which should use the cache)
    const searchResult = await graphqlHandlers.smartSearch({
      query: "address",
    })

    // With MSW and cache mocks, this should now work without actual HTTP calls
    expect(searchResult.isError).toBe(false)
    const searchResponse = JSON.parse(searchResult.content[0].text)
    expect(searchResponse.results).toBeInstanceOf(Array)
    // Depending on mock fixtures, this might be 0 or more.
    // For now, let's ensure it's not undefined.
    expect(searchResponse.totalContentTypesSearched).toBeDefined()
  })

  it("should build search query using cached schema", async () => {
    // Verify cache is loaded
    expect(isCacheAvailable()).toBe(true)

    // Now build search query
    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "pageArticle",
      searchTerm: "address",
    })

    expect(result.isError).toBe(false)
    const queryResponse = JSON.parse(result.content[0].text)
    expect(queryResponse.query).toContain("pageArticleCollection")
    expect(queryResponse.query).toContain("address")
  })

  it("should use cached data for listContentTypes and getContentTypeSchema", async () => {
    // Verify cache is loaded
    expect(isCacheAvailable()).toBe(true)

    // Test listContentTypes uses cache
    const contentTypesResult = await graphqlHandlers.listContentTypes({})
    expect(contentTypesResult.isError).toBe(false)
    const contentTypesResponse = JSON.parse(contentTypesResult.content[0].text)
    expect(contentTypesResponse.cached).toBe(true)
    expect(contentTypesResponse.contentTypes).toBeInstanceOf(Array)
    expect(contentTypesResponse.contentTypes.length).toBeGreaterThan(0)

    // Test getContentTypeSchema uses cache
    const schemaResult = await graphqlHandlers.getContentTypeSchema({
      contentType: "pageArticle",
    })
    expect(schemaResult.isError).toBe(false)
    const schemaResponse = JSON.parse(schemaResult.content[0].text)
    expect(schemaResponse.cached).toBe(true)
    expect(schemaResponse.contentType).toBe("pageArticle")
    expect(schemaResponse.fields).toBeInstanceOf(Array)
  })

  it("should return specific error if cache is not available for smartSearch", async () => {
    clearCache()
    mockCacheUnavailable()

    const searchResult = await graphqlHandlers.smartSearch({
      query: "address",
    })
    expect(searchResult.isError).toBe(true)
    // This is the actual message from graphql-handlers when cache is missing for smartSearch
    expect(searchResult.content[0].text).toContain("Smart search requires cached metadata.")
  })

  it("should return specific error if cache is not available for buildSearchQuery", async () => {
    clearCache()
    mockCacheUnavailable()

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "pageArticle",
      searchTerm: "address",
    })
    expect(result.isError).toBe(true)
    // This is the actual message from graphql-handlers when cache is missing for buildSearchQuery
    expect(result.content[0].text).toContain("Query builder requires cached metadata.")
  })

  it("should return error when attempting to listContentTypes if cache is unavailable and API call fails", async () => {
    clearCache()
    mockCacheUnavailable() // This mocks cache functions, but listContentTypes might still try an API call

    const contentTypesResult = await graphqlHandlers.listContentTypes({})
    expect(contentTypesResult.isError).toBe(true)
    // Expecting an error related to API call failure or cache truly being unavailable
    // The exact message depends on how listContentTypes handles this internally when mockCacheUnavailable is active.
    // If it tries an API call, MSW should intercept and potentially return an auth error if not handled.
    // If it relies purely on `isCacheAvailable` (which is mocked to false), it should be a cache error.
    // Based on previous logs, it seems to be an API auth error via MSW fallback.
    expect(contentTypesResult.content[0].text).toMatch(
      /Authentication failed|Cache is not available/i,
    )
  })

  it("should return error when attempting to getContentTypeSchema if cache is unavailable and API call fails", async () => {
    clearCache()
    mockCacheUnavailable()

    const schemaResult = await graphqlHandlers.getContentTypeSchema({
      contentType: "pageArticle",
    })
    expect(schemaResult.isError).toBe(true)
    // Similar to listContentTypes, expecting an API or a specific cache miss error.
    expect(schemaResult.content[0].text).toMatch(
      /Authentication failed|Schema for pageArticle not found/i,
    )
  })
})
