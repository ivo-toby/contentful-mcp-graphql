#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { CONTENTFUL_PROMPTS } from "./prompts/contentful-prompts.js"
export { CONTENTFUL_PROMPTS }
import { handlePrompt } from "./prompts/handlers.js"
import {
  graphqlHandlers,
  fetchGraphQLSchema,
  setGraphQLSchema,
} from "./handlers/graphql-handlers.js"
import { getTools } from "./types/tools.js"
import { validateEnvironment } from "./utils/validation.js"
import { StreamableHttpServer } from "./transports/streamable-http.js"

// Validate environment variables
validateEnvironment()

// Create AI Action tool context
// Function to get all tools including dynamic AI Action tools
export function getAllTools() {
  // Get all static tools
  const allStaticTools = getTools()

  // Filter tools based on token availability
  const staticTools: Record<string, unknown> = {}

  if (allStaticTools.GRAPHQL_QUERY) staticTools.GRAPHQL_QUERY = allStaticTools.GRAPHQL_QUERY
  if (allStaticTools.GRAPHQL_LIST_CONTENT_TYPES)
    staticTools.GRAPHQL_LIST_CONTENT_TYPES = allStaticTools.GRAPHQL_LIST_CONTENT_TYPES
  if (allStaticTools.GRAPHQL_GET_CONTENT_TYPE_SCHEMA)
    staticTools.GRAPHQL_GET_CONTENT_TYPE_SCHEMA = allStaticTools.GRAPHQL_GET_CONTENT_TYPE_SCHEMA
  if (allStaticTools.GRAPHQL_GET_EXAMPLE)
    staticTools.GRAPHQL_GET_EXAMPLE = allStaticTools.GRAPHQL_GET_EXAMPLE

  return staticTools
}

// Create MCP server
const server = new Server(
  {
    name: "contentful-graphql-mcp-server",
    version: "0.0.1",
  },
  {
    capabilities: {
      tools: getAllTools(),
      prompts: CONTENTFUL_PROMPTS,
    },
  },
)

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  // Return both static and dynamic tools
  return {
    tools: Object.values(getAllTools()),
  }
})

// Set up request handlers
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: Object.values(CONTENTFUL_PROMPTS),
}))

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  const result = await handlePrompt(name, args)
  // Add tools to the prompt result
  // Use Object.values to convert from object to array
  // @ts-ignore - SDK expects a specific tool format
  result.tools = Object.values(getAllTools())
  return {
    messages: result.messages,
    tools: result.tools,
  }
})

// Type-safe handler
// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
server.setRequestHandler(CallToolRequestSchema, async (request, _extra): Promise<any> => {
  try {
    const { name, arguments: args } = request.params
    const handler = getHandler(name)

    if (!handler) {
      throw new Error(`Unknown tool: ${name}`)
    }

    const result = await handler(args || {})
    return result
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

// Helper function to map tool names to handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getHandler(name: string): ((args: any) => Promise<any>) | undefined {
  const cdaOnlyHandlers = {
    // Only GraphQL operations are allowed with just a CDA token
    graphql_query: graphqlHandlers.executeQuery,
    graphql_list_content_types: graphqlHandlers.listContentTypes,
    graphql_get_content_type_schema: graphqlHandlers.getContentTypeSchema,
    graphql_get_example: graphqlHandlers.getExample,
  }

  return cdaOnlyHandlers[name as keyof typeof cdaOnlyHandlers]
}

// Function to fetch GraphQL schema
async function loadGraphQLSchema() {
  try {
    const spaceId = process.env.SPACE_ID
    const environmentId = process.env.ENVIRONMENT_ID || "master"

    // GraphQL REQUIRES a CDA token - Management tokens won't work for GraphQL
    const cdaToken = process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

    // Check if we have the minimum required parameters
    if (!spaceId || !cdaToken) {
      console.error("Unable to fetch GraphQL schema: Space ID or CDA access token not provided")
      return
    }

    console.error(
      `Fetching GraphQL schema for space ${spaceId}, environment ${environmentId} using CDA token...`,
    )
    const schema = await fetchGraphQLSchema(spaceId, environmentId, cdaToken)

    if (schema) {
      setGraphQLSchema(schema)
      console.error("GraphQL schema loaded successfully")
    } else {
      console.error("Failed to load GraphQL schema")
    }
  } catch (error) {
    console.error("Error loading GraphQL schema:", error)
  }
}

// Start the server
async function runServer() {
  // Determine if HTTP server mode is enabled
  const enableHttp = process.env.ENABLE_HTTP_SERVER === "true"
  const httpPort = process.env.HTTP_PORT ? parseInt(process.env.HTTP_PORT) : 3000

  // Load GraphQL schema
  const loadPromises = []
  loadPromises.push(loadGraphQLSchema())

  // Wait for all resources to load
  await Promise.all(loadPromises)

  if (enableHttp) {
    // Start StreamableHTTP server for MCP over HTTP
    const httpServer = new StreamableHttpServer({
      port: httpPort,
      host: process.env.HTTP_HOST || "localhost",
    })

    await httpServer.start()
    console.error(
      `Contentful GraphQL MCP Server running with StreamableHTTP on port ${httpPort}`,
    )

    // Keep the process running
    process.on("SIGINT", async () => {
      console.error("Shutting down HTTP server...")
      await httpServer.stop()
      process.exit(0)
    })
  } else {
    // Traditional stdio mode
    const transport = new StdioServerTransport()

    // Connect to the server
    await server.connect(transport)

    console.error(
      `Contentful GraphQL MCP Server running on stdio`,
    )
  }

  // Set up periodic refresh of GraphQL schema (every 5 minutes)
  setInterval(
    () => {
      loadGraphQLSchema().catch((error) => console.error("Error refreshing GraphQL schema:", error))
    },
    5 * 60 * 1000,
  )
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error)
  process.exit(1)
})
