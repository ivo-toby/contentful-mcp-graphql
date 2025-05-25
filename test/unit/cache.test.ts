import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadContentfulMetadata,
  getCachedContentTypes,
  getCachedContentTypeSchema,
  isCacheAvailable,
  getCacheStatus,
} from '../../src/handlers/graphql-handlers.js'

// Mock fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Contentful Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset cache state
    vi.resetModules()
  })

  const mockContentTypesResponse = {
    data: {
      __schema: {
        queryType: {
          fields: [
            {
              name: 'pageArticleCollection',
              description: 'Page Article Collection',
              type: { kind: 'OBJECT', ofType: { name: 'PageArticleCollection', kind: 'OBJECT' } }
            },
            {
              name: 'topicCategoryCollection', 
              description: 'Topic Category Collection',
              type: { kind: 'OBJECT', ofType: { name: 'TopicCategoryCollection', kind: 'OBJECT' } }
            }
          ]
        }
      }
    }
  }

  const mockPageArticleSchema = {
    data: {
      __type: {
        name: 'PageArticle',
        description: 'Page Article content type',
        fields: [
          { name: 'sys', description: 'System fields', type: { kind: 'NON_NULL', ofType: { name: 'Sys' } } },
          { name: 'title', description: 'Title field', type: { kind: 'SCALAR', name: 'String' } },
          { name: 'slug', description: 'Slug field', type: { kind: 'SCALAR', name: 'String' } },
        ]
      }
    }
  }

  const mockTopicCategorySchema = {
    data: {
      __type: {
        name: 'TopicCategory',
        description: 'Topic Category content type', 
        fields: [
          { name: 'sys', description: 'System fields', type: { kind: 'NON_NULL', ofType: { name: 'Sys' } } },
          { name: 'name', description: 'Name field', type: { kind: 'SCALAR', name: 'String' } },
        ]
      }
    }
  }

  it('should load content types and schemas into cache', async () => {
    // Mock the content types response
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse
      })
      // Mock schema responses
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopicCategorySchema
      })

    await loadContentfulMetadata('test-space', 'master', 'test-token')

    // Check that cache is available
    expect(isCacheAvailable()).toBe(true)

    // Check cached content types
    const contentTypes = getCachedContentTypes()
    expect(contentTypes).toHaveLength(2)
    expect(contentTypes![0]).toEqual({
      name: 'pageArticle',
      description: 'Page Article Collection',
      queryName: 'pageArticleCollection'
    })

    // Check cached schemas
    const pageArticleSchema = getCachedContentTypeSchema('pageArticle')
    expect(pageArticleSchema).toBeDefined()
    expect(pageArticleSchema.contentType).toBe('PageArticle')
    expect(pageArticleSchema.fields).toHaveLength(3)
  })

  it('should handle API errors gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    })

    await loadContentfulMetadata('test-space', 'master', 'invalid-token')

    // Cache should not be available after error
    expect(isCacheAvailable()).toBe(false)
    expect(getCachedContentTypes()).toBeNull()
  })

  it('should provide accurate cache status', async () => {
    // Initially cache should be empty
    const initialStatus = getCacheStatus()
    expect(initialStatus.available).toBe(false)
    expect(initialStatus.contentTypesCount).toBe(0)
    expect(initialStatus.schemasCount).toBe(0)
    expect(initialStatus.lastUpdate).toBeNull()

    // Load cache
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTopicCategorySchema
      })

    await loadContentfulMetadata('test-space', 'master', 'test-token')

    // Check updated status
    const updatedStatus = getCacheStatus()
    expect(updatedStatus.available).toBe(true)
    expect(updatedStatus.contentTypesCount).toBe(2)
    expect(updatedStatus.schemasCount).toBe(2)
    expect(updatedStatus.lastUpdate).toBeInstanceOf(Date)
  })

  it('should handle missing content types in schema response', async () => {
    const emptyResponse = {
      data: {
        __schema: {
          queryType: {
            fields: []
          }
        }
      }
    }

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => emptyResponse
    })

    await loadContentfulMetadata('test-space', 'master', 'test-token')

    const contentTypes = getCachedContentTypes()
    expect(contentTypes).toHaveLength(0)
  })

  it('should continue loading other schemas if one fails', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockContentTypesResponse
      })
      // First schema succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockPageArticleSchema
      })
      // Second schema fails
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      })

    await loadContentfulMetadata('test-space', 'master', 'test-token')

    // Should have content types loaded
    expect(getCachedContentTypes()).toHaveLength(2)
    
    // Should have only one schema (the successful one)
    expect(getCachedContentTypeSchema('pageArticle')).toBeDefined()
    expect(getCachedContentTypeSchema('topicCategory')).toBeNull()
  })
})
