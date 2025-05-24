<img width="700" src="https://images.ctfassets.net/jtqsy5pye0zd/6wNuQ2xMvbw134rccObi0q/bf61badc6d6d9780609e541713f0bba6/Contentful_Logo_2.5_Dark.svg?w=700&q=100" alt="Contentful GraphQL MCP server"/>

# Contentful GraphQL MCP Server

An MCP server implementation that provides GraphQL query capabilities for Contentful's Content Delivery API, enabling efficient content retrieval and schema exploration.

- Please note: if you are not interested in the code, and just want to use this MCP in
  Claude Desktop (or any other tool that is able to use MCP servers) you don't have to
  clone this repo, you can just set it up in Claude desktop, refer to the section
  "Usage with Claude Desktop" for instructions on how to install it.

## Features

- **GraphQL Query Execution**: Execute custom GraphQL queries against Contentful's GraphQL API
- **Schema Exploration**: Discover and understand your Contentful content model structure
- **GraphQL Collection Discovery**: List all available GraphQL query collections in your space
- **Schema Introspection**: Get detailed field information for specific content types
- **Example Query Generation**: Generate example queries to help you get started
- **Smart Pagination**: Efficient handling of large datasets with built-in pagination
- **Token Flexibility**: Works with Content Delivery API (CDA) tokens for secure, read-only access

## GraphQL Capabilities

This MCP server is specifically designed for GraphQL operations with Contentful, providing a more efficient and flexible way to query content compared to REST APIs.

### Key Benefits

- **Flexible Queries**: Retrieve only the fields you need, reducing response size and improving performance
- **Nested References**: Get related content in a single query without multiple API calls
- **Schema Validation**: Queries are validated against the GraphQL schema when available
- **Efficient Data Fetching**: Reduce over-fetching and under-fetching of data
- **Type Safety**: Leverage GraphQL's strong typing system for better query construction

### GraphQL Tools

The MCP server provides four core GraphQL tools:

#### 1. List Content Types (`graphql_list_content_types`)

Discover all available GraphQL query collections in your Contentful space's GraphQL schema.

```typescript
{
  spaceId: string,         // Required: Your Contentful space ID
  environmentId?: string,  // Optional, defaults to "master"
  cdaToken: string        // Required: Content Delivery API token
}
```

#### 2. Get Content Type Schema (`graphql_get_content_type_schema`)

Get detailed schema information for a specific content type, including all fields, their types, and relationships.

```typescript
{
  contentType: string,     // Required: The name of the content type to explore
  spaceId: string,         // Required: Your Contentful space ID
  environmentId?: string,  // Optional, defaults to "master"
  cdaToken: string        // Required: Content Delivery API token
}
```

#### 3. Get Example Query (`graphql_get_example`)

Generate example GraphQL queries for a specific content type to help you understand query structure.

```typescript
{
  contentType: string,     // Required: The content type to generate an example for
  includeRelations?: boolean, // Optional: Whether to include related content
  spaceId: string,         // Required: Your Contentful space ID
  environmentId?: string,  // Optional, defaults to "master"
  cdaToken: string        // Required: Content Delivery API token
}
```

#### 4. Execute Query (`graphql_query`)

Execute custom GraphQL queries against Contentful's GraphQL API.

```typescript
{
  query: string,           // Required: The GraphQL query to execute
  variables?: object,      // Optional: Variables for parameterized queries
  spaceId: string,         // Required: Your Contentful space ID
  environmentId?: string,  // Optional, defaults to "master"
  cdaToken: string        // Required: Content Delivery API token
}
```

### GraphQL Prompts

The MCP server includes two helpful prompts to guide GraphQL schema exploration:

#### 1. Explore GraphQL Schema (`explore-graphql-schema`)

Guides you through a systematic exploration of your GraphQL schema with a specific goal in mind.

```
explore-graphql-schema(goal: "articles about marketing")
```

#### 2. Build GraphQL Query (`build-graphql-query`)

Helps you build a custom GraphQL query for a specific content type with specified fields, filters, and reference handling.

```
build-graphql-query(contentType: "Article", fields: "title,body,publishDate", filters: "publishDate > 2023-01-01", includeReferences: true)
```

## Configuration

### Prerequisites

1. Create a Contentful account at [Contentful](https://www.contentful.com/)
2. Generate a Content Delivery API (CDA) token from your space settings

### Environment Variables

- `CONTENTFUL_DELIVERY_ACCESS_TOKEN` / `--delivery-token`: Your Content Delivery API token (required)
- `SPACE_ID` / `--space-id`: Your Contentful space ID (required)
- `ENVIRONMENT_ID` / `--environment-id`: Environment ID (defaults to "master")
- `ENABLE_HTTP_SERVER` / `--http`: Set to "true" to enable HTTP/SSE mode
- `HTTP_PORT` / `--port`: Port for HTTP server (default: 3000)
- `HTTP_HOST` / `--http-host`: Host for HTTP server (default: localhost)

### Authentication

This MCP server uses Content Delivery API (CDA) tokens for secure, read-only access to your Contentful content. CDA tokens are preferred because:

- **Security**: Read-only access reduces security risks
- **Performance**: Optimized for content delivery
- **GraphQL Support**: Native support for GraphQL operations
- **Caching**: Better caching capabilities for improved performance

**Important**: All GraphQL tools require explicit `spaceId` and `cdaToken` parameters. Environment variables can be used for convenience during development, but the tools will always require these parameters to be passed explicitly for clarity and security.

### Usage with Claude Desktop

You do not need to clone this repo to use this MCP, you can simply add it to
your `claude_desktop_config.json`:

Add or edit `~/Library/Application Support/Claude/claude_desktop_config.json`
and add the following lines:

```json
{
  "mcpServers": {
    "contentful-graphql": {
      "command": "npx",
      "args": ["-y", "@ivotoby/contentful-graphql-mcp-server"],
      "env": {
        "CONTENTFUL_DELIVERY_ACCESS_TOKEN": "<Your CDA token>",
        "SPACE_ID": "<Your Space ID>",
        "ENVIRONMENT_ID": "master"
      }
    }
  }
}
```

If your MCP client does not support setting environment variables, you can also set the tokens using arguments:

```json
{
  "mcpServers": {
    "contentful-graphql": {
      "command": "npx",
      "args": [
        "-y",
        "@ivotoby/contentful-graphql-mcp-server",
        "--delivery-token",
        "<your CDA token>",
        "--space-id",
        "<your Space ID>",
        "--environment-id",
        "master"
      ]
    }
  }
}
```

### Installing via Smithery

To install Contentful GraphQL MCP Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@ivotoby/contentful-graphql-mcp-server):

```bash
npx -y @smithery/cli install @ivotoby/contentful-graphql-mcp-server --client claude
```

### Development Setup

If you want to contribute and test with Claude Desktop:

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/ivo-toby/contentful-mcp-graphql.git
   cd contentful-mcp-graphql
   npm install
   ```

2. Run the development server:

   ```bash
   npm run dev
   ```

3. Update `claude_desktop_config.json` to reference the project directly:
   ```json
   {
     "mcpServers": {
       "contentful-graphql": {
         "command": "node",
         "args": ["/path/to/contentful-mcp-graphql/bin/mcp-server.js"],
         "env": {
           "CONTENTFUL_DELIVERY_ACCESS_TOKEN": "<Your CDA Token>",
           "SPACE_ID": "<Your Space ID>"
         }
       }
     }
   }
   ```

This allows you to test modifications in the MCP server with Claude directly. If you add new tools or resources, you will need to restart Claude Desktop.

## Development Tools

### MCP Inspector

The project includes an MCP Inspector tool for development and debugging:

- **Inspect Mode**: Run `npm run inspect` to start the inspector at http://localhost:5173
- **Watch Mode**: Use `npm run inspect-watch` to automatically restart the inspector when files change
- **Visual Interface**: Test and debug MCP tools through a web interface
- **Real-time Testing**: Try out GraphQL queries and see responses immediately

### Available Scripts

- `npm run build`: Build the project
- `npm run dev`: Development mode with auto-rebuild on changes
- `npm run inspect`: Start the MCP inspector
- `npm run inspect-watch`: Start the inspector with file watching
- `npm run test`: Run tests
- `npm run lint`: Run ESLint
- `npm run typecheck`: Run TypeScript type checking

## Transport Modes

The MCP server supports two transport modes:

### stdio Transport (Default)

The default transport mode uses standard input/output streams for communication, ideal for integration with MCP clients like Claude Desktop.

```bash
npx -y @ivotoby/contentful-graphql-mcp-server --delivery-token YOUR_TOKEN --space-id YOUR_SPACE_ID
```

### StreamableHTTP Transport

For web-based integrations or standalone service deployment:

```bash
npx -y @ivotoby/contentful-graphql-mcp-server --delivery-token YOUR_TOKEN --space-id YOUR_SPACE_ID --http --port 3000
```

The StreamableHTTP implementation follows the standard MCP protocol specification, allowing any MCP client to connect without special handling.

## Example Usage

### Basic Content Query

```graphql
query {
  entryCollection(limit: 5) {
    items {
      sys {
        id
      }
      title
      description
    }
  }
}
```

### Query with References

```graphql
query {
  articleCollection(limit: 3) {
    items {
      title
      body
      author {
        name
        bio
      }
      tagsCollection {
        items {
          name
        }
      }
    }
  }
}
```

### Filtered Query

```graphql
query {
  articleCollection(where: { publishDate_gte: "2023-01-01" }, order: publishDate_DESC, limit: 10) {
    items {
      title
      publishDate
      slug
    }
  }
}
```

## Error Handling

The server implements comprehensive error handling for:

- Authentication failures with CDA tokens
- Invalid GraphQL queries
- Network connectivity issues
- Schema introspection errors
- Rate limiting from Contentful's API

## Security

This MCP server is designed with security in mind:

- **Read-only Access**: Uses CDA tokens for content delivery only
- **No Write Operations**: Cannot modify or delete content
- **Token Scoping**: Tokens are scoped to specific spaces and environments
- **Input Validation**: All queries are validated before execution

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## Support

This MCP server is community-maintained and not officially supported by Contentful. For issues and feature requests, please use the GitHub issue tracker.
