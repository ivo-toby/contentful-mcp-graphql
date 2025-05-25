import { describe, it, expect, beforeEach, vi } from 'vitest'
import { graphqlHandlers } from '../../src/handlers/graphql-handlers.js'

// Mock the cache functions
const mockIsCacheAvailable = vi.fn()
const mockGetCachedContentTypes = vi.fn()
const mockGetCachedContentTypeSchema = vi.fn()

vi.mock('../../src/handlers/graphql-handlers.js', async () => {
  const actual = await vi.importActual('../../src/handlers/graphql-handlers.js')
  return {
    ...actual,
    isCacheAvailable: mockIsCacheAvailable,
    getCachedContentTypes: mockGetCachedContentTypes,
    getCachedContentTypeSchema: mockGetCachedContentTypeSchema,
  }
})

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Mock environment variables
vi.stubEnv('SPACE_ID', 'test-space')
vi.stubEnv('ENVIRONMENT_ID', 'master')
vi.stubEnv('CONTENTFUL_DELIVERY_ACCESS_TOKEN', 'test-token')

describe('Smart Search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockContentTypes = [
    { name: 'pageArticle', queryName: 'pageArticleCollection', description: 'Page articles' },
    { name: 'topicCategory', queryName: 'topicCategoryCollection', description: 'Topic categories' }
  ]

  const mockPageArticleSchema = {
    contentType: 'PageArticle',
    fields: [
      { name: 'sys', type: 'Sys!', description: 'System fields' },
      { name: 'title', type: 'String', description: 'Title field' },
      { name: 'internalName', type: 'String', description: 'Internal name' },
      { name: 'slug', type: 'String', description: 'URL slug' }
    ]
  }

  const mockTopicCategorySchema = {
    contentType: 'TopicCategory',
    fields: [
      { name: 'sys', type: 'Sys!', description: 'System fields' },
      { name: 'name', type: 'String', description: 'Category name' },
      { name: 'description', type: 'String', description: 'Category description' }
    ]
  }

  it('should perform smart search across multiple content types', async () => {
    // Mock cache availability
    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue(mockContentTypes)
    mockGetCachedContentTypeSchema
      .mockReturnValueOnce(mockPageArticleSchema)
      .mockReturnValueOnce(mockTopicCategorySchema)

    // Mock GraphQL responses
    const mockSearchResponse1 = {
      data: {
        pageArticleCollection: {
          items: [
            {
              sys: { id: '1' },
              title: 'How do I update my address?',
              internalName: 'Update address guide',
              slug: 'update-address'
            }
          ]
        }
      }
    }

    const mockSearchResponse2 = {
      data: {
        topicCategoryCollection: {
          items: []
        }
      }
    }

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse1
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSearchResponse2
      })

    const result = await graphqlHandlers.smartSearch({
      query: 'address',
      limit: 5
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    
    expect(response.query).toBe('address')
    expect(response.results).toHaveLength(1)
    expect(response.results[0].contentType).toBe('pageArticle')
    expect(response.results[0].items[0].title).toBe('How do I update my address?')
    expect(response.totalContentTypesSearched).toBe(2)
    expect(response.contentTypesWithResults).toBe(1)
  })

  it('should filter content types when specified', async () => {
    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue(mockContentTypes)
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchema)

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          pageArticleCollection: {
            items: []
          }
        }
      })
    })

    const result = await graphqlHandlers.smartSearch({
      query: 'test',
      contentTypes: ['pageArticle'],
      limit: 3
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.totalContentTypesSearched).toBe(1)

    // Should only call fetch once (for pageArticle only)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should handle cache not available', async () => {
    mockIsCacheAvailable.mockReturnValue(false)

    const result = await graphqlHandlers.smartSearch({
      query: 'test'
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Smart search requires cached metadata')
  })

  it('should handle missing environment variables', async () => {
    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue(mockContentTypes)

    vi.stubEnv('SPACE_ID', '')

    const result = await graphqlHandlers.smartSearch({
      query: 'test'
    })

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Space ID and CDA token are required')
  })

  it('should skip content types with no searchable fields', async () => {
    const schemaWithNoTextFields = {
      contentType: 'Asset',
      fields: [
        { name: 'sys', type: 'Sys!', description: 'System fields' },
        { name: 'width', type: 'Int', description: 'Width in pixels' },
        { name: 'height', type: 'Int', description: 'Height in pixels' }
      ]
    }

    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue([
      { name: 'asset', queryName: 'assetCollection', description: 'Assets' }
    ])
    mockGetCachedContentTypeSchema.mockReturnValue(schemaWithNoTextFields)

    const result = await graphqlHandlers.smartSearch({
      query: 'test'
    })

    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.results).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should handle GraphQL errors gracefully', async () => {
    mockIsCacheAvailable.mockReturnValue(true)
    mockGetCachedContentTypes.mockReturnValue([mockContentTypes[0]])
    mockGetCachedContentTypeSchema.mockReturnValue(mockPageArticleSchema)

    // Mock a GraphQL error response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        errors: [{ message: 'Field "title_contains" is not defined' }]
      })
    })

    const result = await graphqlHandlers.smartSearch({
      query: 'test'
    })

    // Should not throw, should continue gracefully
    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.results).toHaveLength(0)
  })
})
