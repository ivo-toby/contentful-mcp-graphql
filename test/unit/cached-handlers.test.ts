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

describe('Cached GraphQL Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockCachedContentTypes = [
    { name: 'pageArticle', queryName: 'pageArticleCollection', description: 'Page articles' },
    { name: 'topicCategory', queryName: 'topicCategoryCollection', description: 'Topic categories' }
  ]

  const mockCachedSchema = {
    contentType: 'PageArticle',
    description: 'Page Article content type',
    fields: [
      { name: 'sys', type: 'Sys!', description: 'System fields' },
      { name: 'title', type: 'String', description: 'Title field' },
      { name: 'slug', type: 'String', description: 'URL slug' }
    ],
    note: 'Use this schema to construct your GraphQL queries. For example queries, use the graphql_get_example tool.'
  }

  describe('listContentTypes', () => {
    it('should return cached content types when cache is available', async () => {
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypes.mockReturnValue(mockCachedContentTypes)

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBe(true)
      expect(response.contentTypes).toEqual(mockCachedContentTypes)
      expect(response.message).toContain('from cache')
      
      // Should not make API calls
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should fallback to API when cache is not available', async () => {
      mockIsCacheAvailable.mockReturnValue(false)
      
      const mockApiResponse = {
        data: {
          __schema: {
            queryType: {
              fields: [
                {
                  name: 'pageArticleCollection',
                  description: 'Page Article Collection',
                  type: { kind: 'OBJECT', ofType: { name: 'PageArticleCollection', kind: 'OBJECT' } }
                }
              ]
            }
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBeUndefined()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle missing environment variables', async () => {
      mockIsCacheAvailable.mockReturnValue(false)
      vi.stubEnv('SPACE_ID', '')

      const result = await graphqlHandlers.listContentTypes({})

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Space ID is required')
    })
  })

  describe('getContentTypeSchema', () => {
    it('should return cached schema when available', async () => {
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypeSchema.mockReturnValue(mockCachedSchema)

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: 'PageArticle'
      })

      expect(result.isError).toBeFalsy()
      const response = JSON.parse(result.content[0].text)
      expect(response.cached).toBe(true)
      expect(response.contentType).toBe('PageArticle')
      expect(response.note).toContain('from cache')
      
      // Should not make API calls
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should try Collection suffix if not found in cache', async () => {
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypeSchema
        .mockReturnValueOnce(null) // First call for 'PageArticle'
        .mockReturnValueOnce(mockCachedSchema) // Second call for 'PageArticleCollection'

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: 'PageArticle'
      })

      expect(result.isError).toBeFalsy()
      expect(mockGetCachedContentTypeSchema).toHaveBeenCalledWith('PageArticle')
      expect(mockGetCachedContentTypeSchema).toHaveBeenCalledWith('PageArticleCollection')
    })

    it('should fallback to API when not in cache', async () => {
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypeSchema.mockReturnValue(null)

      const mockApiResponse = {
        data: {
          __type: {
            name: 'PageArticle',
            description: 'Page Article content type',
            fields: [
              { name: 'title', description: 'Title field', type: { kind: 'SCALAR', name: 'String' } }
            ]
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: 'PageArticle'
      })

      expect(result.isError).toBeFalsy()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should handle cache not available', async () => {
      mockIsCacheAvailable.mockReturnValue(false)
      
      const mockApiResponse = {
        data: {
          __type: {
            name: 'PageArticle',
            description: 'Page Article content type',
            fields: []
          }
        }
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockApiResponse
      })

      const result = await graphqlHandlers.getContentTypeSchema({
        contentType: 'PageArticle'
      })

      expect(result.isError).toBeFalsy()
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('helper functions', () => {
    it('should correctly identify scalar types', async () => {
      // This is testing the isScalarType function indirectly through buildSearchQuery
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypeSchema.mockReturnValue({
        contentType: 'TestType',
        fields: [
          { name: 'stringField', type: 'String', description: 'A string field' },
          { name: 'intField', type: 'Int', description: 'An integer field' },
          { name: 'boolField', type: 'Boolean', description: 'A boolean field' },
          { name: 'dateField', type: 'DateTime', description: 'A date field' },
          { name: 'objectField', type: 'SomeObject', description: 'An object field' }
        ]
      })

      const result = await graphqlHandlers.buildSearchQuery({
        contentType: 'TestType',
        searchTerm: 'test'
      })

      expect(result.isError).toBeFalsy()
      const queryText = result.content[0].text
      
      // Should include scalar fields in selection
      expect(queryText).toContain('stringField')
      expect(queryText).toContain('intField')
      expect(queryText).toContain('boolField')
      expect(queryText).toContain('dateField')
      
      // Should not include object field
      expect(queryText).not.toContain('objectField')
    })

    it('should correctly identify searchable text fields', async () => {
      mockIsCacheAvailable.mockReturnValue(true)
      mockGetCachedContentTypeSchema.mockReturnValue({
        contentType: 'TestType',
        fields: [
          { name: 'searchableText', type: 'String', description: 'Searchable text' },
          { name: 'requiredText', type: 'String!', description: 'Required text (not searchable)' },
          { name: 'numberField', type: 'Int', description: 'Number field' },
          { name: 'arrayField', type: '[String]', description: 'Array field' }
        ]
      })

      const result = await graphqlHandlers.buildSearchQuery({
        contentType: 'TestType',
        searchTerm: 'test'
      })

      expect(result.isError).toBeFalsy()
      const queryText = result.content[0].text
      
      // Should include searchable text field
      expect(queryText).toContain('{ searchableText_contains: $searchTerm }')
      
      // Should not include required text field (has !)
      expect(queryText).not.toContain('{ requiredText_contains: $searchTerm }')
      
      // Should not include non-string fields
      expect(queryText).not.toContain('{ numberField_contains: $searchTerm }')
      expect(queryText).not.toContain('{ arrayField_contains: $searchTerm }')
    })
  })
})
