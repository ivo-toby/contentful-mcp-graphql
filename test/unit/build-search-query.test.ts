import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  graphqlHandlers,
  clearCache,
  loadContentfulMetadata,
} from "../../src/handlers/graphql-handlers.js"

// Mock undici fetch - buildSearchQuery doesn't directly call fetch,
// but underlying cache loaders might if not properly mocked.
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
    graphqlHandlers: {
      ...actual.graphqlHandlers,
    },
    isCacheAvailable: mockIsCacheAvailable,
    getCachedContentTypes: mockGetCachedContentTypes,
    getCachedContentTypeSchema: mockGetCachedContentTypeSchema,
    clearCache: actual.clearCache,
  }
})

describe("Build Search Query", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearCache()

    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue(null)
    mockGetCachedContentTypeSchema.mockReturnValue(null)

    vi.stubEnv("SPACE_ID", "test-space")
    vi.stubEnv("ENVIRONMENT_ID", "master")
    vi.stubEnv("CONTENTFUL_DELIVERY_ACCESS_TOKEN", "test-token")
  })

  const mockPageArticleContentType = {
    name: "pageArticle",
    queryName: "pageArticleCollection",
    description: "Page Article",
  }

  const mockPageArticleSchemaData = {
    contentType: "PageArticle",
    description: "Page Article content type",
    fields: [
      { name: "sys", type: "Sys!", description: "System fields" },
      { name: "title", type: "String", description: "Title field" },
      { name: "slug", type: "String", description: "URL slug" },
      { name: "body", type: "String", description: "Body content" },
      { name: "author", type: "String", description: "Author name" }, // Non-searchable for this test
      { name: "tags", type: "[String]", description: "Tags" }, // Array, non-searchable
    ],
  }

  const mockTestSchemaData = {
    contentType: "TestType",
    description: "Test content type",
    fields: [
      { name: "stringField", type: "String", description: "Searchable String" },
      { name: "intField", type: "Int", description: "Int field" },
      { name: "boolField", type: "Boolean", description: "Boolean field" },
      { name: "dateField", type: "DateTime", description: "Date field" },
      { name: "objectField", type: "SomeObject", description: "Object field" },
      { name: "requiredText", type: "String!", description: "Required String" },
    ],
  }

  it("should build a search query for a content type", async () => {
    mockGetCachedContentTypes.mockReturnValue([mockPageArticleContentType])
    mockGetCachedContentTypeSchema.mockImplementation((contentTypeName) => {
      if (contentTypeName === "PageArticle" || contentTypeName === "pageArticle") {
        return mockPageArticleSchemaData
      }
      return null
    })

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "hello world",
    })

    expect(result.isError).toBeFalsy()
    const queryText = result.content[0].text

    expect(queryText).toContain("query SearchPageArticle($searchTerm: String!)")
    expect(queryText).toContain("pageArticleCollection(where: { OR: [")
    expect(queryText).toContain("{ title_contains: $searchTerm }")
    expect(queryText).toContain("{ slug_contains: $searchTerm }")

    // Should include variables
    expect(queryText).toContain('"searchTerm": "hello world"')

    // Should list searchable fields
    expect(queryText).toContain("- title (String)")
    expect(queryText).toContain("- slug (String)")
  })

  it("should handle content type with Collection suffix", async () => {
    mockGetCachedContentTypes.mockReturnValue([
      { name: "pageArticle", queryName: "pageArticleCollection", description: "Page Article" },
    ])
    mockGetCachedContentTypeSchema.mockImplementation((contentTypeName) => {
      if (contentTypeName === "PageArticleCollection") {
        return {
          contentType: "PageArticleCollection",
          fields: mockPageArticleSchemaData.fields,
        }
      } else if (contentTypeName === "PageArticle") {
        return null
      }
      return null
    })

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "test",
    })

    expect(result.isError).toBeFalsy()
    expect(result.content[0].text).toContain("PageArticleCollection")
  })

  it("should filter to specific fields when provided", async () => {
    mockGetCachedContentTypes.mockReturnValue([mockPageArticleContentType])
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchemaData)

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "test",
      fields: ["title", "slug"],
    })

    expect(result.isError).toBeFalsy()
    const queryText = result.content[0].text

    // Should only include specified fields
    expect(queryText).toContain("{ title_contains: $searchTerm }")
    expect(queryText).toContain("{ slug_contains: $searchTerm }")
    expect(queryText).not.toContain("{ internalName_contains: $searchTerm }")
  })

  it("should handle cache not available", async () => {
    mockIsCacheAvailable.mockReturnValue(false)

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "test",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("Query builder requires cached metadata")
  })

  it("should handle content type not found", async () => {
    mockGetCachedContentTypes.mockReturnValue([])
    mockGetCachedContentTypeSchema.mockReturnValue(null)

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "NonExistentType",
      searchTerm: "test",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Content type "NonExistentType" not found in cache')
  })

  it("should handle content type with no searchable fields", async () => {
    const assetContentType = { name: "Asset", queryName: "assetCollection", description: "Assets" }
    const assetSchemaNoSearchable = {
      contentType: "Asset",
      fields: [
        { name: "sys", type: "Sys!" },
        { name: "width", type: "Int" },
        { name: "height", type: "Int" },
      ],
    }
    mockGetCachedContentTypes.mockReturnValue([assetContentType])
    mockGetCachedContentTypeSchema.mockImplementation((contentTypeName) => {
      if (contentTypeName === "Asset") return assetSchemaNoSearchable
      return null
    })

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "Asset",
      searchTerm: "test",
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("No searchable text fields found")
    expect(result.content[0].text).toContain("Available fields:")
  })

  it("should handle specified fields that are not searchable", async () => {
    mockGetCachedContentTypes.mockReturnValue([mockPageArticleContentType])
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchemaData)

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "test",
      fields: ["author", "tags"],
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain("No searchable text fields found")
  })

  it("should include all scalar fields in selection", async () => {
    mockGetCachedContentTypes.mockReturnValue([mockPageArticleContentType])
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchemaData)

    const result = await graphqlHandlers.buildSearchQuery({
      contentType: "PageArticle",
      searchTerm: "test",
    })

    expect(result.isError).toBeFalsy()
    const queryText = result.content[0].text

    // Should include all scalar fields in the selection
    expect(queryText).toContain("sys { id }")
    expect(queryText).toContain("title")
    expect(queryText).toContain("slug")
    expect(queryText).toContain("body")
    expect(queryText).toContain("author")
    expect(queryText).toContain("tags")
  })
})
