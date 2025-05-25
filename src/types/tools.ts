// Define interface for config parameter
interface ConfigSchema {
  type: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  properties: Record<string, any>
  required?: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

// Helper function to add optional environment override properties
// These are optional since the values come from environment variables by default
export const getOptionalEnvProperties = (config: ConfigSchema): ConfigSchema => {
  const envProperties = {
    spaceId: {
      type: "string",
      description: "Optional override for the space ID (defaults to SPACE_ID environment variable)",
    },
    environmentId: {
      type: "string",
      description: "Optional override for the environment ID (defaults to ENVIRONMENT_ID environment variable or 'master')",
    },
  }

  // Don't require these properties since they come from environment variables
  return {
    ...config,
    properties: {
      ...config.properties,
      ...envProperties,
    },
    // Keep existing required fields but don't add spaceId/environmentId
    required: config.required || [],
  }
}

// Tool definitions for GraphQL operations
export const getGraphQLTools = () => {
  return {
    GRAPHQL_LIST_CONTENT_TYPES: {
      name: "graphql_list_content_types",
      description:
        "IMPORTANT: Use this tool FIRST before attempting to write any GraphQL queries. This tool lists all available content types in the Contentful space's GraphQL schema. You should always use this tool to understand what content types are available before formulating GraphQL queries. The space ID and CDA token are automatically retrieved from environment variables.",
      inputSchema: getOptionalEnvProperties({
        type: "object",
        properties: {},
        required: [],
      }),
    },

    GRAPHQL_GET_CONTENT_TYPE_SCHEMA: {
      name: "graphql_get_content_type_schema",
      description:
        "IMPORTANT: Use this tool AFTER using graphql_list_content_types to get a detailed schema for a specific content type. This tool provides all fields, their types, and relationships for a content type. You should ALWAYS use this tool to understand the structure of a content type before creating a query for it. The space ID and CDA token are automatically retrieved from environment variables.",
      inputSchema: getOptionalEnvProperties({
        type: "object",
        properties: {
          contentType: {
            type: "string",
            description: "The name of the content type to fetch schema for (e.g., 'BlogPost')",
          },
        },
        required: ["contentType"],
      }),
    },

    GRAPHQL_GET_EXAMPLE: {
      name: "graphql_get_example",
      description:
        "IMPORTANT: Use this tool AFTER using graphql_get_content_type_schema to see example GraphQL queries for a specific content type. Learning from these examples will help you construct valid queries. The space ID and CDA token are automatically retrieved from environment variables.",
      inputSchema: getOptionalEnvProperties({
        type: "object",
        properties: {
          contentType: {
            type: "string",
            description: "The name of the content type for the example query",
          },
          includeRelations: {
            type: "boolean",
            description:
              "Whether to include related content types in the example (defaults to false)",
          },
        },
        required: ["contentType"],
      }),
    },

    GRAPHQL_QUERY: {
      name: "graphql_query",
      description:
        "IMPORTANT: Before using this tool, you MUST first use graphql_list_content_types and graphql_get_content_type_schema to understand the available content types and their structure. Execute a GraphQL query against the Contentful GraphQL API. This tool allows you to use Contentful's powerful GraphQL interface to retrieve content in a more flexible and efficient way than REST API calls. The space ID and CDA token are automatically retrieved from environment variables.",
      inputSchema: getOptionalEnvProperties({
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The GraphQL query string to execute (must be a valid GraphQL query)",
          },
          variables: {
            type: "object",
            description: "Optional variables for the GraphQL query",
            additionalProperties: true,
          },
        },
        required: ["query"],
      }),
    },
  }
}

// Export combined tools
export const getTools = () => {
  return {
    ...getGraphQLTools(),
  }
}
