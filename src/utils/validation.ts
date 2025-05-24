export function validateEnvironment(): void {
  const { CONTENTFUL_DELIVERY_ACCESS_TOKEN, ENABLE_HTTP_SERVER, HTTP_PORT } = process.env

  // Check if we have at least a delivery token (required for GraphQL operations)
  const hasCdaToken = !!CONTENTFUL_DELIVERY_ACCESS_TOKEN

  if (!hasCdaToken) {
    console.error("CONTENTFUL_DELIVERY_ACCESS_TOKEN must be set for GraphQL operations")
    process.exit(1)
  }

  // Validate HTTP server settings if enabled
  if (ENABLE_HTTP_SERVER === "true") {
    if (HTTP_PORT) {
      const port = parseInt(HTTP_PORT)
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error("HTTP_PORT must be a valid port number (1-65535)")
        process.exit(1)
      }
    }
  }
}
