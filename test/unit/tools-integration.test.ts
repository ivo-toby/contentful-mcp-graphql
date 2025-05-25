import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAllTools } from '../../src/index.js'

describe('Tools Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should include all expected tools', () => {
    const tools = getAllTools()
    
    expect(tools).toHaveProperty('GRAPHQL_QUERY')
    expect(tools).toHaveProperty('GRAPHQL_LIST_CONTENT_TYPES')
    expect(tools).toHaveProperty('GRAPHQL_GET_CONTENT_TYPE_SCHEMA')
    expect(tools).toHaveProperty('GRAPHQL_GET_EXAMPLE')
    expect(tools).toHaveProperty('SMART_SEARCH')
    expect(tools).toHaveProperty('BUILD_SEARCH_QUERY')
  })

  it('should have proper tool definitions for new tools', () => {
    const tools = getAllTools()
    
    // Check SMART_SEARCH tool
    const smartSearch = tools.SMART_SEARCH as any
    expect(smartSearch.name).toBe('smart_search')
    expect(smartSearch.description).toContain('intelligent search across multiple content types')
    expect(smartSearch.inputSchema.properties.query).toBeDefined()
    expect(smartSearch.inputSchema.properties.contentTypes).toBeDefined()
    expect(smartSearch.inputSchema.properties.limit).toBeDefined()
    expect(smartSearch.inputSchema.required).toContain('query')
    
    // Check BUILD_SEARCH_QUERY tool
    const buildQuery = tools.BUILD_SEARCH_QUERY as any
    expect(buildQuery.name).toBe('build_search_query')
    expect(buildQuery.description).toContain('Generate a GraphQL search query')
    expect(buildQuery.inputSchema.properties.contentType).toBeDefined()
    expect(buildQuery.inputSchema.properties.searchTerm).toBeDefined()
    expect(buildQuery.inputSchema.properties.fields).toBeDefined()
    expect(buildQuery.inputSchema.required).toEqual(['contentType', 'searchTerm'])
  })

  it('should include optional environment properties for all tools', () => {
    const tools = getAllTools()
    
    Object.values(tools).forEach((tool: any) => {
      expect(tool.inputSchema.properties).toHaveProperty('spaceId')
      expect(tool.inputSchema.properties).toHaveProperty('environmentId')
      expect(tool.inputSchema.properties.spaceId.description).toContain('SPACE_ID environment variable')
      expect(tool.inputSchema.properties.environmentId.description).toContain('ENVIRONMENT_ID environment variable')
    })
  })

  it('should not require spaceId and environmentId in tool schemas', () => {
    const tools = getAllTools()
    
    Object.values(tools).forEach((tool: any) => {
      const required = tool.inputSchema.required || []
      expect(required).not.toContain('spaceId')
      expect(required).not.toContain('environmentId')
    })
  })

  it('should have consistent property types across tools', () => {
    const tools = getAllTools()
    
    Object.values(tools).forEach((tool: any) => {
      const props = tool.inputSchema.properties
      
      if (props.spaceId) {
        expect(props.spaceId.type).toBe('string')
      }
      
      if (props.environmentId) {
        expect(props.environmentId.type).toBe('string')
      }
      
      if (props.query) {
        expect(props.query.type).toBe('string')
      }
    })
  })
})
