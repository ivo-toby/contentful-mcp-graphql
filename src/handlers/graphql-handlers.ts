/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetch } from "undici"
import { buildClientSchema, getIntrospectionQuery, validate, parse, GraphQLSchema } from "graphql"

// Store the GraphQL schema globally so it can be reused for validation
let graphqlSchema: GraphQLSchema | null = null

// Store content types and schemas in memory for fast access
let contentTypesCache: Array<{ name: string; queryName: string; description?: string }> | null =
  null
let contentTypeSchemasCache: Map<string, any> = new Map()
let lastCacheUpdate: Date | null = null

// Interfaces for GraphQL schema exploration tools
export interface ListContentTypesArgs {
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
}

export interface GetContentTypeSchemaArgs {
  contentType: string
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
}

export interface GetGraphQLExampleArgs {
  contentType: string
  includeRelations?: boolean
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
}

export interface SmartSearchArgs {
  query: string
  contentTypes?: string[] // Optional filter to specific content types
  limit?: number // Limit per content type (default: 5)
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
}

export interface BuildSearchQueryArgs {
  contentType: string
  searchTerm: string
  fields?: string[] // Optional specific fields to search
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
}

// Types for GraphQL API responses
interface GraphQLResponseBase {
  errors?: Array<{ message: string }>
}

interface GraphQLIntrospectionResponse extends GraphQLResponseBase {
  data: {
    __schema: any
  }
}

interface GraphQLContentTypesResponse extends GraphQLResponseBase {
  data: {
    __schema: {
      queryType: {
        fields: Array<{
          name: string
          description?: string
          type?: {
            kind?: string
            name?: string
            ofType?: {
              name?: string
              kind?: string
            }
          }
        }>
      }
    }
  }
}

interface GraphQLTypeResponse extends GraphQLResponseBase {
  data: {
    __type?: {
      name: string
      description?: string
      fields: Array<{
        name: string
        description?: string
        type: any
      }>
    }
  }
}

interface GraphQLExecuteResponse extends GraphQLResponseBase {
  data?: Record<string, any>
}

// Tool response type
interface ToolResponse {
  content: Array<{
    type: string
    text: string
  }>
  isError?: boolean
}

// Function to fetch the GraphQL schema via introspection
export async function fetchGraphQLSchema(
  spaceId: string,
  environmentId: string,
  accessToken: string,
): Promise<GraphQLSchema | null> {
  try {
    // We must have a CDA token for GraphQL - management tokens won't work for GraphQL schema introspection
    if (!accessToken) {
      console.error("No delivery access token provided for GraphQL schema fetch")
      return null
    }

    const introspectionQuery = getIntrospectionQuery()
    const endpoint = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`

    console.error(
      `Fetching GraphQL schema for space ${spaceId}, environment ${environmentId} using delivery token...`,
    )
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: introspectionQuery }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Failed to fetch GraphQL schema: ${errorText}`)
      return null
    }

    const introspectionResult = (await response.json()) as GraphQLIntrospectionResponse

    if (introspectionResult.errors) {
      console.error(`GraphQL introspection errors: ${JSON.stringify(introspectionResult.errors)}`)
      return null
    }

    // Build a schema from the introspection result
    const schema = buildClientSchema(introspectionResult.data)

    // Log the schema types for debugging
    console.error(`GraphQL schema loaded with ${Object.keys(schema.getTypeMap()).length} types`)

    return schema
  } catch (error) {
    console.error(`Error fetching GraphQL schema: ${error}`)
    return null
  }
}

// Set the GraphQL schema for later use
export function setGraphQLSchema(schema: GraphQLSchema): void {
  graphqlSchema = schema

  // Count the available query fields as a sanity check
  const queryType = schema.getQueryType()
  if (queryType) {
    const fieldCount = Object.keys(queryType.getFields()).length
    console.error(`GraphQL schema contains ${fieldCount} query fields`)
  }
}

// Load and cache content types and their schemas
export async function loadContentfulMetadata(
  spaceId: string,
  environmentId: string,
  accessToken: string,
): Promise<void> {
  try {
    console.error("Loading Contentful metadata into cache...")

    // Load content types using the existing handler but bypass the cache check
    const contentTypesResult = await loadContentTypesFromAPI(spaceId, environmentId, accessToken)
    if (contentTypesResult.isError) {
      console.error("Failed to load content types:", contentTypesResult.content[0].text)
      return
    }

    const parsedResult = JSON.parse(contentTypesResult.content[0].text)
    contentTypesCache = parsedResult.contentTypes
    console.error(`Loaded ${contentTypesCache?.length || 0} content types`)

    // Load schemas for each content type
    if (contentTypesCache) {
      const schemaPromises = contentTypesCache.map(async (ct) => {
        try {
          const schemaResult = await loadContentTypeSchemaFromAPI(
            ct.name,
            spaceId,
            environmentId,
            accessToken,
          )
          if (!schemaResult.isError) {
            const parsedSchema = JSON.parse(schemaResult.content[0].text)
            contentTypeSchemasCache.set(parsedSchema.contentType, parsedSchema)
          }
        } catch (error) {
          console.error(`Failed to load schema for ${ct.name}:`, error)
        }
      })

      await Promise.all(schemaPromises)
      console.error(`Loaded schemas for ${contentTypeSchemasCache.size} content types`)
    }

    lastCacheUpdate = new Date()
    console.error("Contentful metadata cache loaded successfully")
  } catch (error) {
    console.error("Error loading Contentful metadata:", error)
  }
}

// Get cached content types
export function getCachedContentTypes(): Array<{
  name: string
  queryName: string
  description?: string
}> | null {
  return contentTypesCache
}

// Get cached content type schema
export function getCachedContentTypeSchema(contentType: string): any | null {
  return contentTypeSchemasCache.get(contentType) || null
}

// Check if cache is available and fresh
export function isCacheAvailable(): boolean {
  return contentTypesCache !== null && contentTypeSchemasCache.size > 0
}

// Get cache status
export function getCacheStatus(): {
  available: boolean
  contentTypesCount: number
  schemasCount: number
  lastUpdate: Date | null
} {
  return {
    available: isCacheAvailable(),
    contentTypesCount: contentTypesCache?.length || 0,
    schemasCount: contentTypeSchemasCache.size,
    lastUpdate: lastCacheUpdate,
  }
}

// Clear cache (for testing purposes)
export function clearCache(): void {
  contentTypesCache = null
  contentTypeSchemasCache.clear()
  lastCacheUpdate = null
}

// Interface for GraphQL query arguments
export interface GraphQLQueryArgs {
  spaceId?: string // Optional override for environment variable
  environmentId?: string // Optional override for environment variable
  query: string
  variables?: Record<string, any>
}

// Helper functions to load data from API (used by cache loader)
async function loadContentTypesFromAPI(
  spaceId: string,
  environmentId: string,
  accessToken: string,
): Promise<ToolResponse> {
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`

  const query = `
    query {
      __schema {
        queryType {
          fields {
            name
            description
            type {
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  `

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      content: [{ type: "text", text: `HTTP Error ${response.status}: ${errorText}` }],
      isError: true,
    }
  }

  const result = (await response.json()) as GraphQLContentTypesResponse

  if (result.errors) {
    return {
      content: [{ type: "text", text: JSON.stringify({ errors: result.errors }, null, 2) }],
      isError: true,
    }
  }

  const contentTypeFields = result.data.__schema.queryType.fields
    .filter(
      (field: any) =>
        field.name.endsWith("Collection") ||
        (field.type?.kind === "OBJECT" && field.type?.name?.endsWith("Collection")),
    )
    .map((field: any) => ({
      name: field.name.replace("Collection", ""),
      description: field.description || `Content type for ${field.name}`,
      queryName: field.name,
    }))

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            message:
              "Available content types in this Contentful space. Use graphql_get_content_type_schema to explore a specific content type.",
            contentTypes: contentTypeFields,
          },
          null,
          2,
        ),
      },
    ],
  }
}

async function loadContentTypeSchemaFromAPI(
  contentType: string,
  spaceId: string,
  environmentId: string,
  accessToken: string,
): Promise<ToolResponse> {
  const endpoint = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`

  const query = `
    query {
      __type(name: "${contentType}") {
        name
        description
        fields {
          name
          description
          type {
            kind
            name
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
    }
  `

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      content: [{ type: "text", text: `HTTP Error ${response.status}: ${errorText}` }],
      isError: true,
    }
  }

  const result = (await response.json()) as GraphQLTypeResponse

  if (result.errors) {
    return {
      content: [{ type: "text", text: JSON.stringify({ errors: result.errors }, null, 2) }],
      isError: true,
    }
  }

  if (!result.data.__type) {
    if (!contentType.endsWith("Collection")) {
      return loadContentTypeSchemaFromAPI(
        `${contentType}Collection`,
        spaceId,
        environmentId,
        accessToken,
      )
    }
    return {
      content: [
        {
          type: "text",
          text: `Content type "${contentType}" not found in the schema.`,
        },
      ],
      isError: true,
    }
  }

  const fields =
    result.data.__type?.fields.map((field) => ({
      name: field.name,
      description: field.description || `Field ${field.name}`,
      type: formatGraphQLType(field.type),
    })) || []

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            contentType: result.data.__type.name,
            description: result.data.__type.description,
            fields,
            note: "Use this schema to construct your GraphQL queries. For example queries, use the graphql_get_example tool.",
          },
          null,
          2,
        ),
      },
    ],
  }
}

// Execute a GraphQL query against the Contentful GraphQL API
export const graphqlHandlers = {
  // List all content types available in the GraphQL schema
  listContentTypes: async (args: ListContentTypesArgs): Promise<ToolResponse> => {
    try {
      // Check cache first
      if (isCacheAvailable()) {
        const cachedContentTypes = getCachedContentTypes()
        if (cachedContentTypes) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    message:
                      "Available content types in this Contentful space (from cache). Use graphql_get_content_type_schema to explore a specific content type.",
                    contentTypes: cachedContentTypes,
                    cached: true,
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }
      }

      // Fallback to API if cache not available
      const spaceId = args.spaceId || process.env.SPACE_ID
      const environmentId = args.environmentId || process.env.ENVIRONMENT_ID || "master"
      const accessToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

      if (!spaceId) {
        return {
          content: [
            {
              type: "text",
              text: "Space ID is required (set SPACE_ID environment variable or provide spaceId parameter)",
            },
          ],
          isError: true,
        }
      }

      if (!accessToken) {
        return {
          content: [
            {
              type: "text",
              text: "Content Delivery API (CDA) token is required for GraphQL queries (set CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable)",
            },
          ],
          isError: true,
        }
      }

      return await loadContentTypesFromAPI(spaceId, environmentId, accessToken)
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching content types: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },

  // Get schema details for a specific content type
  getContentTypeSchema: async (args: GetContentTypeSchemaArgs): Promise<ToolResponse> => {
    try {
      // Check cache first
      if (isCacheAvailable()) {
        const cachedSchema = getCachedContentTypeSchema(args.contentType)
        if (cachedSchema) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ...cachedSchema,
                    cached: true,
                    note: "Use this schema to construct your GraphQL queries (from cache). For example queries, use the graphql_get_example tool.",
                  },
                  null,
                  2,
                ),
              },
            ],
          }
        }

        // Try with Collection suffix if not found in cache
        if (!args.contentType.endsWith("Collection")) {
          const collectionSchema = getCachedContentTypeSchema(`${args.contentType}Collection`)
          if (collectionSchema) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      ...collectionSchema,
                      cached: true,
                      note: "Use this schema to construct your GraphQL queries (from cache). For example queries, use the graphql_get_example tool.",
                    },
                    null,
                    2,
                  ),
                },
              ],
            }
          }
        }
      }

      // Fallback to API if not in cache
      const spaceId = args.spaceId || process.env.SPACE_ID
      const environmentId = args.environmentId || process.env.ENVIRONMENT_ID || "master"
      const accessToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

      if (!spaceId) {
        return {
          content: [
            {
              type: "text",
              text: "Space ID is required (set SPACE_ID environment variable or provide spaceId parameter)",
            },
          ],
          isError: true,
        }
      }

      if (!accessToken) {
        return {
          content: [
            {
              type: "text",
              text: "Content Delivery API (CDA) token is required for GraphQL queries (set CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable)",
            },
          ],
          isError: true,
        }
      }

      return await loadContentTypeSchemaFromAPI(
        args.contentType,
        spaceId,
        environmentId,
        accessToken,
      )
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error fetching content type schema: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },

  // Get example GraphQL queries for a content type
  getExample: async (args: GetGraphQLExampleArgs): Promise<ToolResponse> => {
    try {
      // Get values from environment variables with optional overrides
      const spaceId = args.spaceId || process.env.SPACE_ID
      const environmentId = args.environmentId || process.env.ENVIRONMENT_ID || "master"

      // First get the schema
      const schemaResult = await graphqlHandlers.getContentTypeSchema({
        contentType: args.contentType,
        spaceId,
        environmentId,
      })

      if (schemaResult.isError) {
        return schemaResult
      }

      // Parse the schema from the result
      const schemaData = JSON.parse(schemaResult.content[0].text)

      // Generate a query for collection
      const isCollection = schemaData.contentType.endsWith("Collection")
      const contentTypeName = isCollection
        ? schemaData.contentType
        : schemaData.contentType.replace(/^[A-Z]/, (c: string) => c.toLowerCase())
      const collectionName = isCollection ? contentTypeName : `${contentTypeName}Collection`
      const singularName = isCollection
        ? contentTypeName.replace("Collection", "")
        : contentTypeName

      // Get top-level scalar fields
      const scalarFields = schemaData.fields
        .filter((field: any) => isScalarType(field.type))
        .map((field: any) => field.name)

      // Get reference fields if requested
      const referenceFields = args.includeRelations
        ? schemaData.fields
            .filter((field: any) => isReferenceType(field.type))
            .map((field: any) => ({
              name: field.name,
              type: field.type.replace("!", ""),
            }))
        : []

      // Build the example query
      let exampleQuery = `# Example query for ${schemaData.contentType}
query {
  ${collectionName}(limit: 5) {
    items {
${scalarFields.map((field: string) => `      ${field}`).join("\n")}`

      if (referenceFields.length > 0) {
        exampleQuery += `\n
      # Related content references
${referenceFields
  .map(
    (field: any) => `      ${field.name} {
        ... on ${field.type} {
          # Add fields you want from ${field.type} here
        }
      }`,
  )
  .join("\n")}`
      }

      exampleQuery += `\n    }
  }
}

# You can also query a single item by ID
query GetSingle${singularName}($id: String!) {
  ${singularName}(id: $id) {
${scalarFields.map((field: string) => `    ${field}`).join("\n")}
  }
}

# Variables for the above query would be:
# {
#   "id": "your-entry-id-here"
# }`

      return {
        content: [
          {
            type: "text",
            text: exampleQuery,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error generating example query: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },

  // Execute a GraphQL query
  executeQuery: async (args: GraphQLQueryArgs): Promise<ToolResponse> => {
    try {
      // Get values from environment variables with optional overrides
      const spaceId = args.spaceId || process.env.SPACE_ID
      const environmentId = args.environmentId || process.env.ENVIRONMENT_ID || "master"
      const accessToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

      if (!spaceId) {
        return {
          content: [
            {
              type: "text",
              text: "Space ID is required (set SPACE_ID environment variable or provide spaceId parameter)",
            },
          ],
          isError: true,
        }
      }

      if (!accessToken) {
        return {
          content: [
            {
              type: "text",
              text: "Content Delivery API (CDA) token is required for GraphQL queries (set CONTENTFUL_DELIVERY_ACCESS_TOKEN environment variable)",
            },
          ],
          isError: true,
        }
      }

      // Validate the query against the schema if available
      if (graphqlSchema) {
        try {
          const queryDocument = parse(args.query)
          const validationErrors = validate(graphqlSchema, queryDocument)

          if (validationErrors.length > 0) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      errors: validationErrors.map((error) => ({ message: error.message })),
                    },
                    null,
                    2,
                  ),
                },
              ],
              isError: true,
            }
          }
        } catch (parseError) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    errors: [{ message: `GraphQL query parsing error: ${parseError}` }],
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          }
        }
      } else {
        console.warn("GraphQL schema not available for validation")
      }

      // Execute the query against the Contentful GraphQL API
      const endpoint = `https://graphql.contentful.com/content/v1/spaces/${spaceId}/environments/${environmentId}`

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          query: args.query,
          variables: args.variables || {},
        }),
      })

      // Handle HTTP error responses
      if (!response.ok) {
        const errorText = await response.text()
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  errors: [{ message: `HTTP Error ${response.status}: ${errorText}` }],
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
      }

      const result = (await response.json()) as GraphQLExecuteResponse

      console.error("GraphQL response:", JSON.stringify(result))

      // Check for GraphQL errors
      if (result.errors) {
        const errorResponse = {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  errors: result.errors,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
        console.error("Returning error response:", JSON.stringify(errorResponse))
        return errorResponse
      }

      // Return the successful result
      const successResponse = {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      }
      console.error("Returning success response:", JSON.stringify(successResponse))
      return successResponse
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                errors: [
                  {
                    message: `Error executing GraphQL query: ${error instanceof Error ? error.message : String(error)}`,
                  },
                ],
              },
              null,
              2,
            ),
          },
        ],
        isError: true,
      }
    }
  },

  // Smart search across multiple content types
  smartSearch: async (args: SmartSearchArgs): Promise<ToolResponse> => {
    try {
      if (!isCacheAvailable()) {
        return {
          content: [
            {
              type: "text",
              text: "Smart search requires cached metadata. Please wait for the cache to load or use individual GraphQL queries.",
            },
          ],
          isError: true,
        }
      }

      const spaceId = args.spaceId || process.env.SPACE_ID
      const environmentId = args.environmentId || process.env.ENVIRONMENT_ID || "master"
      const accessToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN
      const limit = args.limit || 5

      if (!spaceId || !accessToken) {
        return {
          content: [
            {
              type: "text",
              text: "Space ID and CDA token are required for smart search",
            },
          ],
          isError: true,
        }
      }

      const contentTypes = getCachedContentTypes()
      if (!contentTypes) {
        return {
          content: [{ type: "text", text: "No content types available in cache" }],
          isError: true,
        }
      }

      // Filter content types if specified
      const targetContentTypes = args.contentTypes
        ? contentTypes.filter((ct) => args.contentTypes!.includes(ct.name))
        : contentTypes

      const searchPromises = targetContentTypes.map(async (contentType) => {
        try {
          const schema = getCachedContentTypeSchema(contentType.name)
          if (!schema) return null

          // Find searchable text fields
          const textFields = schema.fields.filter((field: any) => isSearchableTextField(field.type))
          if (textFields.length === 0) return null

          // Build search query with OR conditions across text fields
          const searchConditions = textFields
            .map((field: any) => `{ ${field.name}_contains: $searchTerm }`)
            .join(", ")

          const query = `
            query SearchIn${contentType.name}($searchTerm: String!) {
              ${contentType.queryName}(where: { OR: [${searchConditions}] }, limit: ${limit}) {
                items {
                  sys { id }
                  ${textFields.map((field: any) => field.name).join("\n                  ")}
                }
              }
            }
          `

          const result = await graphqlHandlers.executeQuery({
            query,
            variables: { searchTerm: args.query },
            spaceId,
            environmentId,
          })

          if (!result.isError) {
            const data = JSON.parse(result.content[0].text)
            const items = data.data?.[contentType.queryName]?.items || []
            if (items.length > 0) {
              return {
                contentType: contentType.name,
                items: items.map((item: any) => ({
                  id: item.sys.id,
                  ...Object.fromEntries(
                    textFields.map((field: any) => [field.name, item[field.name]]),
                  ),
                })),
              }
            }
          }
          return null
        } catch (error) {
          console.error(`Search error for ${contentType.name}:`, error)
          return null
        }
      })

      const results = await Promise.all(searchPromises)
      const validResults = results.filter(Boolean)

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                query: args.query,
                results: validResults,
                totalContentTypesSearched: targetContentTypes.length,
                contentTypesWithResults: validResults.length,
              },
              null,
              2,
            ),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error in smart search: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },

  // Build a search query for a specific content type
  buildSearchQuery: async (args: BuildSearchQueryArgs): Promise<ToolResponse> => {
    try {
      if (!isCacheAvailable()) {
        return {
          content: [
            {
              type: "text",
              text: "Query builder requires cached metadata. Please wait for the cache to load.",
            },
          ],
          isError: true,
        }
      }

      const schema = getCachedContentTypeSchema(args.contentType)
      if (!schema) {
        // Try with Collection suffix
        const collectionSchema = getCachedContentTypeSchema(`${args.contentType}Collection`)
        if (!collectionSchema) {
          return {
            content: [
              {
                type: "text",
                text: `Content type "${args.contentType}" not found in cache. Use graphql_list_content_types to see available content types.`,
              },
            ],
            isError: true,
          }
        }
      }

      const actualSchema = schema || getCachedContentTypeSchema(`${args.contentType}Collection`)
      const contentTypeName = actualSchema.contentType

      // Find the correct query name from cached content types
      const cachedContentTypes = getCachedContentTypes()
      const contentTypeInfo = cachedContentTypes?.find(
        (ct) =>
          ct.name === args.contentType ||
          ct.name === contentTypeName ||
          ct.queryName === contentTypeName,
      )

      const queryName =
        contentTypeInfo?.queryName ||
        (contentTypeName.endsWith("Collection") ? contentTypeName : `${contentTypeName}Collection`)

      // Determine which fields to search
      let fieldsToSearch = actualSchema.fields.filter((field: any) =>
        isSearchableTextField(field.type),
      )

      if (args.fields && args.fields.length > 0) {
        // Use only specified fields that are also searchable
        fieldsToSearch = fieldsToSearch.filter((field: any) => args.fields!.includes(field.name))
      }

      if (fieldsToSearch.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No searchable text fields found for content type "${args.contentType}". Available fields: ${actualSchema.fields.map((f: any) => f.name).join(", ")}`,
            },
          ],
          isError: true,
        }
      }

      // Build search conditions
      const searchConditions = fieldsToSearch
        .map((field: any) => `{ ${field.name}_contains: $searchTerm }`)
        .join(", ")

      // Get all fields for selection (scalars only for simplicity)
      const scalarFields = actualSchema.fields
        .filter((field: any) => isScalarType(field.type))
        .map((field: any) => field.name)

      const query = `query Search${contentTypeName.replace("Collection", "")}($searchTerm: String!) {
  ${queryName}(where: { OR: [${searchConditions}] }, limit: 10) {
    items {
      sys { id }
${scalarFields.map((field: any) => `      ${field}`).join("\n")}
    }
  }
}`

      return {
        content: [
          {
            type: "text",
            text: query,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error building search query: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      }
    }
  },
}

// Helper functions for GraphQL type formatting
function formatGraphQLType(typeInfo: any): string {
  if (!typeInfo) return "Unknown"

  if (typeInfo.kind === "NON_NULL") {
    return `${formatGraphQLType(typeInfo.ofType)}!`
  } else if (typeInfo.kind === "LIST") {
    return `[${formatGraphQLType(typeInfo.ofType)}]`
  } else if (typeInfo.name) {
    return typeInfo.name
  } else if (typeInfo.ofType && typeInfo.ofType.name) {
    return typeInfo.ofType.name
  }

  return "Unknown"
}

function isScalarType(typeString: string): boolean {
  const scalarTypes = ["String", "Int", "Float", "Boolean", "ID", "DateTime", "JSON"]
  return scalarTypes.some((scalar) => typeString.includes(scalar))
}

function isSearchableTextField(typeString: string): boolean {
  // Text fields that support _contains search
  return typeString === "String"
}

function isReferenceType(typeString: string): boolean {
  // Exclude scalar types, collections, connections, etc.
  return (
    !isScalarType(typeString) &&
    !typeString.includes("Collection") &&
    !typeString.includes("Connection")
  )
}

// Export helper functions for unit testing
export { formatGraphQLType, isScalarType, isSearchableTextField, isReferenceType }
