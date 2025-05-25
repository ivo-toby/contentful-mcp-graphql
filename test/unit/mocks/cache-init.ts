import { GraphQLSchema } from "graphql"
import { vi } from "vitest"

// Define types for mocked data to ensure consistency
type MockContentType = {
  name: string
  queryName: string
  description: string
}

type MockSchemaField = {
  name: string
  description: string
  type: { kind: string; name?: string; ofType?: { name?: string; kind?: string } }
}

type MockSchema = {
  contentType: string
  name: string
  description: string
  fields: MockSchemaField[]
}

interface CacheStatus {
  available: boolean
  contentTypesCount: number
  schemasCount: number
  lastUpdate: Date | null
}

// Type for the arguments of getContentTypeSchema, based on original
interface GetContentTypeSchemaArgs {
  contentType: string
  spaceId?: string
  environmentId?: string
}

// Hoistable data definitions
const mockContentTypesData: MockContentType[] = [
  {
    name: "pageArticle",
    queryName: "pageArticleCollection",
    description: "Page Article Collection",
  },
  {
    name: "topicCategory",
    queryName: "topicCategoryCollection",
    description: "Topic Category Collection",
  },
]

const mockSchemasData = new Map<string, MockSchema>([
  [
    "pageArticle",
    {
      contentType: "pageArticle",
      name: "PageArticle",
      description: "Page Article content type",
      fields: [
        {
          name: "sys",
          description: "System fields",
          type: { kind: "NON_NULL", ofType: { name: "Sys", kind: "OBJECT" } },
        },
        { name: "title", description: "Title field", type: { kind: "SCALAR", name: "String" } },
        { name: "slug", description: "Slug field", type: { kind: "SCALAR", name: "String" } },
        { name: "content", description: "Content field", type: { kind: "SCALAR", name: "String" } },
      ],
    },
  ],
  [
    "topicCategory",
    {
      contentType: "topicCategory",
      name: "TopicCategory",
      description: "Topic Category content type",
      fields: [
        {
          name: "sys",
          description: "System fields",
          type: { kind: "NON_NULL", ofType: { name: "Sys", kind: "OBJECT" } },
        },
        { name: "title", description: "Title field", type: { kind: "SCALAR", name: "String" } },
        { name: "slug", description: "Slug field", type: { kind: "SCALAR", name: "String" } },
      ],
    },
  ],
])

const mockGraphQLSchemaData: GraphQLSchema | null = {
  getQueryType: () => ({
    getFields: () => ({ pageArticleCollection: {}, topicCategoryCollection: {} }),
  }),
  getTypeMap: () => ({
    PageArticle: mockSchemasData.get("pageArticle"),
    TopicCategory: mockSchemasData.get("topicCategory"),
    Sys: { name: "Sys", kind: "OBJECT" },
  }),
} as unknown as GraphQLSchema

let mutableMockGraphQLHandlers: any

vi.mock("../../../src/handlers/graphql-handlers", async () => {
  const ActualGraphQLHandlers = await import("../../../src/handlers/graphql-handlers")

  const mockHandlers = {
    ...ActualGraphQLHandlers, // Reverted: Assuming named exports or direct function exports
    getCacheStatus: vi.fn(
      (): CacheStatus => ({
        available: true,
        contentTypesCount: mockContentTypesData.length,
        schemasCount: mockSchemasData.size,
        lastUpdate: new Date(),
      }),
    ),
    isCacheAvailable: vi.fn(() => true),
    getCachedContentTypes: vi.fn((): MockContentType[] | null => mockContentTypesData),
    getCachedContentTypeSchema: vi.fn(
      (contentType: string): MockSchema | null => mockSchemasData.get(contentType) || null,
    ),
    setGraphQLSchema: vi.fn(),
    loadContentfulMetadata: vi.fn().mockResolvedValue(undefined),
    listContentTypes: vi.fn().mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({ cached: true, contentTypes: mockContentTypesData }),
        },
      ],
    }),
    getContentTypeSchema: vi.fn().mockImplementation(async (args: GetContentTypeSchemaArgs) => {
      const schema = mockSchemasData.get(args.contentType)
      if (schema) {
        return Promise.resolve({
          isError: false,
          content: [{ type: "text", text: JSON.stringify({ cached: true, ...schema }) }],
        })
      }
      return Promise.resolve({
        isError: true,
        content: [{ type: "text", text: `Mock: Schema for ${args.contentType} not found` }],
      })
    }),
    smartSearch: vi.fn().mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            results: [],
            totalContentTypesSearched: mockContentTypesData.length,
            messages: ["Mocked smart search successful"],
          }),
        },
      ],
    }),
    buildSearchQuery: vi.fn().mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: `SELECT * FROM mock WHERE content LIKE '%test%'`,
            params: {},
            message: "Mocked buildSearchQuery successful",
          }),
        },
      ],
    }),
    clearCache: vi.fn(() => {
      ;(mockHandlers.getCacheStatus as ReturnType<typeof vi.fn>)
        .mockReturnValue({
          available: true,
          contentTypesCount: mockContentTypesData.length,
          schemasCount: mockSchemasData.size,
          lastUpdate: new Date(),
        })(mockHandlers.isCacheAvailable as ReturnType<typeof vi.fn>)
        .mockReturnValue(true)(mockHandlers.getCachedContentTypes as ReturnType<typeof vi.fn>)
        .mockReturnValue(mockContentTypesData)(
          mockHandlers.getCachedContentTypeSchema as ReturnType<typeof vi.fn>,
        )
        .mockImplementation((ct: string) => mockSchemasData.get(ct) || null)(
          mockHandlers.listContentTypes as ReturnType<typeof vi.fn>,
        )
        .mockResolvedValue({
          isError: false,
          content: [
            {
              type: "text",
              text: JSON.stringify({ cached: true, contentTypes: mockContentTypesData }),
            },
          ],
        })(mockHandlers.getContentTypeSchema as ReturnType<typeof vi.fn>)
        .mockImplementation(async (args: GetContentTypeSchemaArgs) => {
          const schema = mockSchemasData.get(args.contentType)
          if (schema)
            return Promise.resolve({
              isError: false,
              content: [{ type: "text", text: JSON.stringify({ cached: true, ...schema }) }],
            })
          return Promise.resolve({
            isError: true,
            content: [{ type: "text", text: `Mock: Schema for ${args.contentType} not found` }],
          })
        })(mockHandlers.smartSearch as ReturnType<typeof vi.fn>)
        .mockResolvedValue({
          isError: false,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                results: [],
                totalContentTypesSearched: mockContentTypesData.length,
                messages: ["Mocked smart search successful"],
              }),
            },
          ],
        })(mockHandlers.buildSearchQuery as ReturnType<typeof vi.fn>)
        .mockResolvedValue({
          isError: false,
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: `SELECT * FROM mock WHERE content LIKE '%test%'`,
                params: {},
                message: "Mocked buildSearchQuery successful",
              }),
            },
          ],
        })
    }),
  }

  mutableMockGraphQLHandlers = mockHandlers
  return mockHandlers
})

export function initializeTestCache() {
  if (!mutableMockGraphQLHandlers) {
    console.warn("Cache mock init before factory completion.")
    return
  }
  ;(mutableMockGraphQLHandlers.getCacheStatus as ReturnType<typeof vi.fn>)
    .mockReturnValue({
      available: true,
      contentTypesCount: mockContentTypesData.length,
      schemasCount: mockSchemasData.size,
      lastUpdate: new Date(),
    })(mutableMockGraphQLHandlers.isCacheAvailable as ReturnType<typeof vi.fn>)
    .mockReturnValue(true)(
      mutableMockGraphQLHandlers.getCachedContentTypes as ReturnType<typeof vi.fn>,
    )
    .mockReturnValue(mockContentTypesData)(
      mutableMockGraphQLHandlers.getCachedContentTypeSchema as ReturnType<typeof vi.fn>,
    )
    .mockImplementation((contentType: string) => mockSchemasData.get(contentType) || null)(
      mutableMockGraphQLHandlers.loadContentfulMetadata as ReturnType<typeof vi.fn>,
    )
    .mockResolvedValue(undefined)(
      mutableMockGraphQLHandlers.listContentTypes as ReturnType<typeof vi.fn>,
    )
    .mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({ cached: true, contentTypes: mockContentTypesData }),
        },
      ],
    })(mutableMockGraphQLHandlers.getContentTypeSchema as ReturnType<typeof vi.fn>)
    .mockImplementation(async (args: GetContentTypeSchemaArgs) => {
      const schema = mockSchemasData.get(args.contentType)
      if (schema) {
        return Promise.resolve({
          isError: false,
          content: [{ type: "text", text: JSON.stringify({ cached: true, ...schema }) }],
        })
      }
      return Promise.resolve({
        isError: true,
        content: [{ type: "text", text: `Mock: Schema for ${args.contentType} not found` }],
      })
    })(mutableMockGraphQLHandlers.smartSearch as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            results: [],
            totalContentTypesSearched: mockContentTypesData.length,
            messages: ["Mocked smart search successful"],
          }),
        },
      ],
    })(mutableMockGraphQLHandlers.buildSearchQuery as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: false,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            query: `SELECT * FROM mock WHERE content LIKE '%test%'`,
            params: {},
            message: "Mocked buildSearchQuery successful",
          }),
        },
      ],
    })
}

export function cleanupTestCache() {
  if (!mutableMockGraphQLHandlers) return
  vi.restoreAllMocks()
  mutableMockGraphQLHandlers.clearCache()
}

export function mockCacheUnavailable() {
  if (!mutableMockGraphQLHandlers) return
  ;(mutableMockGraphQLHandlers.getCacheStatus as ReturnType<typeof vi.fn>)
    .mockReturnValue({
      available: false,
      contentTypesCount: 0,
      schemasCount: 0,
      lastUpdate: null,
    })(mutableMockGraphQLHandlers.isCacheAvailable as ReturnType<typeof vi.fn>)
    .mockReturnValue(false)(
      mutableMockGraphQLHandlers.getCachedContentTypes as ReturnType<typeof vi.fn>,
    )
    .mockReturnValue(null)(
      mutableMockGraphQLHandlers.getCachedContentTypeSchema as ReturnType<typeof vi.fn>,
    )
    .mockReturnValue(null)(mutableMockGraphQLHandlers.listContentTypes as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Cache is not available" }],
    })(mutableMockGraphQLHandlers.getContentTypeSchema as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Cache is not available" }],
    })(mutableMockGraphQLHandlers.smartSearch as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Cache is not available" }],
    })(mutableMockGraphQLHandlers.buildSearchQuery as ReturnType<typeof vi.fn>)
    .mockResolvedValue({
      isError: true,
      content: [{ type: "text", text: "Cache is not available" }],
    })
}

// Export a way to access the mutable mock for direct manipulation or spying in tests if absolutely necessary
export { mutableMockGraphQLHandlers as mgh }
