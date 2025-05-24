import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { CONTENTFUL_PROMPTS } from "../prompts/contentful-prompts.js"
import { handlePrompt } from "../prompts/handlers.js"
import { randomUUID } from "crypto"
import express, { Request, Response } from "express"
import cors from "cors"
import { getTools } from "../types/tools.js"
import {
  isInitializeRequest,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import {
  graphqlHandlers,
  fetchGraphQLSchema,
  setGraphQLSchema,
} from "../handlers/graphql-handlers.js"

/**
 * Configuration options for the HTTP server
 */
export interface StreamableHttpServerOptions {
  port?: number
  host?: string
  corsOptions?: cors.CorsOptions
}

/**
 * Class to handle HTTP server setup and configuration using the official MCP StreamableHTTP transport
 */
export class StreamableHttpServer {
  private app: express.Application
  // @ts-expect-error - This property will be initialized in the start() method
  private server: import("http").Server
  private port: number
  private host: string

  // Map to store transports by session ID
  private transports: Record<string, StreamableHTTPServerTransport> = {}

  /**
   * Create a new HTTP server for MCP over HTTP
   *
   * @param options Configuration options
   */
  constructor(options: StreamableHttpServerOptions = {}) {
    this.port = options.port || 3000
    this.host = options.host || "localhost"

    // Create Express app
    this.app = express()

    // Initialize tools
    this.initializeTools()

    // Configure CORS
    this.app.use(
      cors(
        options.corsOptions || {
          origin: "*",
          methods: ["GET", "POST", "DELETE"],
          allowedHeaders: ["Content-Type", "MCP-Session-ID"],
          exposedHeaders: ["MCP-Session-ID"],
        },
      ),
    )

    // Configure JSON body parsing
    this.app.use(express.json())

    // Set up routes
    this.setupRoutes()
  }

  /**
   * Set up the routes for MCP over HTTP
   */
  private setupRoutes(): void {
    // Handle all MCP requests (POST, GET, DELETE) on a single endpoint
    this.app.all("/mcp", async (req: Request, res: Response) => {
      try {
        if (req.method === "POST") {
          // Check for existing session ID
          const sessionId = req.headers["mcp-session-id"] as string | undefined
          let transport: StreamableHTTPServerTransport

          if (sessionId && this.transports[sessionId]) {
            // Reuse existing transport
            transport = this.transports[sessionId]
          } else if (!sessionId && isInitializeRequest(req.body)) {
            // Create a new server instance for this connection
            const server = new Server(
              {
                name: "contentful-graphql-mcp-server",
                version: "0.0.1",
              },
              {
                capabilities: {
                  tools: this.tools,
                  prompts: CONTENTFUL_PROMPTS,
                },
              },
            )

            // New initialization request
            transport = new StreamableHTTPServerTransport({
              sessionIdGenerator: () => randomUUID(),
              onsessioninitialized: (sid) => {
                // Store the transport by session ID
                this.transports[sid] = transport
              },
            })

            // Clean up transport when closed
            transport.onclose = () => {
              if (transport.sessionId) {
                delete this.transports[transport.sessionId]
                console.log(`Session ${transport.sessionId} closed`)
              }
            }

            // Set up request handlers
            this.setupServerHandlers(server)

            // Connect to the MCP server
            await server.connect(transport)
          } else {
            // Invalid request
            res.status(400).json({
              jsonrpc: "2.0",
              error: {
                code: -32000,
                message: "Bad Request: No valid session ID provided for non-initialize request",
              },
              id: null,
            })
            return
          }

          // Handle the request
          await transport.handleRequest(req, res, req.body)
        } else if (req.method === "GET") {
          // Server-sent events endpoint for notifications
          const sessionId = req.headers["mcp-session-id"] as string | undefined

          if (!sessionId || !this.transports[sessionId]) {
            res.status(400).send("Invalid or missing session ID")
            return
          }

          const transport = this.transports[sessionId]
          await transport.handleRequest(req, res)
        } else if (req.method === "DELETE") {
          // Session termination
          const sessionId = req.headers["mcp-session-id"] as string | undefined

          if (!sessionId || !this.transports[sessionId]) {
            res.status(400).send("Invalid or missing session ID")
            return
          }

          const transport = this.transports[sessionId]
          await transport.handleRequest(req, res)
        } else {
          // Other methods not supported
          res.status(405).send("Method not allowed")
        }
      } catch (error) {
        console.error("Error handling MCP request:", error)
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: `Internal server error: ${error instanceof Error ? error.message : String(error)}`,
            },
            id: null,
          })
        }
      }
    })

    // Add a health check endpoint
    this.app.get("/health", (_req: Request, res: Response) => {
      res.status(200).json({
        status: "ok",
        sessions: Object.keys(this.transports).length,
      })
    })
  }

  /**
   * Set up the request handlers for a server instance
   *
   * @param server Server instance
   */
  private setupServerHandlers(server: Server): void {
    // List tools handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Object.values(this.tools),
      }
    })

    // List prompts handler
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: Object.values(CONTENTFUL_PROMPTS),
      }
    })

    // Get prompt handler
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      const result = await handlePrompt(name, args)
      // Add tools to the prompt result
      // Use the tools from this server instance
      // @ts-expect-error - SDK expects a specific tool format
      result.tools = Object.values(this.tools)

      // Return the result with proper typing to match expected format
      return {
        messages: result.messages,
        tools: result.tools,
      }
    })

    // Call tool handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params
        const handler = this.getHandler(name)

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
  }

  // Tools available for this server instance
  private tools: Record<
    string,
    {
      name: string
      description: string
      inputSchema: {
        type: string
        properties: Record<string, unknown>
      }
    }
  > = {}

  /**
   * Initialize available tools based on authentication
   */
  private initializeTools(): void {
    try {
      // Get all tools from the tools.js module
      const toolsObj = getTools()

      // Convert the tools format to match our expected format
      const formattedTools: Record<
        string,
        {
          name: string
          description: string
          inputSchema: {
            type: string
            properties: Record<string, unknown>
          }
        }
      > = {}

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      Object.entries(toolsObj).forEach(([_key, tool]) => {
        const toolObject = tool as any

        // Skip undefined tools
        if (!toolObject) return

        formattedTools[toolObject.name] = {
          name: toolObject.name,
          description: toolObject.description || "",
          inputSchema: toolObject.inputSchema || { type: "object", properties: {} },
        }
      })

      // Set the tools
      this.tools = formattedTools
    } catch (error) {
      console.error("Error initializing tools for StreamableHttpServer:", error)

      // Fallback to minimal set of tools if there's an error
      this.tools = {}
    }
  }

  /**
   * Helper function to map tool names to handlers
   */
  // The exact return type constraints are too strict but this works at runtime
  private getHandler(name: string):
    | ((args: Record<string, unknown>) => Promise<{
        content?: Array<{ type: string; text: string }>
        isError?: boolean
        message?: string
      }>)
    | undefined {
    // Determine which authentication methods are available
    const cdaOnlyHandlers = {
      // Only GraphQL operations are allowed with just a CDA token
      graphql_query: graphqlHandlers.executeQuery,
      graphql_list_content_types: graphqlHandlers.listContentTypes,
      graphql_get_content_type_schema: graphqlHandlers.getContentTypeSchema,
      graphql_get_example: graphqlHandlers.getExample,
    }

    // @ts-expect-error - The exact parameter and return types don't match, but they work at runtime
    return cdaOnlyHandlers[name as keyof typeof cdaOnlyHandlers]
  }

  /**
   * Load GraphQL schema if CDA token is available
   * Note: We only want to load GraphQL schema when a CDA token is provided
   */
  private async loadGraphQLSchema(): Promise<void> {
    try {
      // Only load GraphQL schema if we have CDA token
      const hasCdaToken = !!process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

      if (!hasCdaToken) {
        console.error("Skipping GraphQL schema loading for StreamableHTTP: Requires CDA token")
        return
      }

      if (!process.env.SPACE_ID) {
        console.error("Skipping GraphQL schema loading for StreamableHTTP: Requires Space ID")
        return
      }

      // Fetch the GraphQL schema - note that fetchGraphQLSchema takes 3 separate parameters
      const schema = await fetchGraphQLSchema(
        process.env.SPACE_ID || "",
        process.env.ENVIRONMENT_ID || "master",
        process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN || "",
      )

      if (schema) {
        setGraphQLSchema(schema)
        console.error("GraphQL schema loaded successfully for StreamableHTTP")
      } else {
        console.error("Failed to load GraphQL schema for StreamableHTTP")
      }
    } catch (error) {
      console.error("Error loading GraphQL schema for StreamableHTTP:", error)
    }
  }

  /**
   * Start the HTTP server
   *
   * @returns Promise that resolves when the server is started
   */
  public async start(): Promise<void> {
    // Determine which authentication methods are available
    const hasCdaToken = !!process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

    // Load resources based on available tokens
    const loadPromises = []

    if (hasCdaToken && process.env.SPACE_ID) {
      loadPromises.push(this.loadGraphQLSchema())
    }

    // Wait for all resources to load
    await Promise.all(loadPromises)

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.error(`MCP StreamableHTTP server running on http://${this.host}:${this.port}/mcp`)
        resolve()
      })

      // Handle server errors
      this.server.on("error", (err: Error) => {
        console.error(`Server error: ${err.message}`)
      })
    })
  }

  /**
   * Stop the HTTP server
   *
   * @returns Promise that resolves when the server is stopped
   */
  public async stop(): Promise<void> {
    // Close all transports
    for (const sessionId in this.transports) {
      try {
        await this.transports[sessionId].close()
      } catch (error) {
        console.error(`Error closing session ${sessionId}:`, error)
      }
    }

    // Close the HTTP server
    if (this.server) {
      return new Promise((resolve, reject) => {
        this.server.close((err?: Error) => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }
  }
}
