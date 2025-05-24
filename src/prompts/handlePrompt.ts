// Import just the types we need
import { graphqlHandlers } from "./promptHandlers/graphql"

// Define the correct interfaces to match SDK requirements
interface MessageContent {
  type: "text"
  text: string
}

interface Message {
  role: "user" | "assistant"
  content: MessageContent
}

// Define interface for tool objects with required properties
interface ToolObject {
  function: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
}

export interface PromptResult {
  messages: Message[]
  tools?: ToolObject[] // Properly typed tools array
}

/**
 * Handle a prompt request and return the appropriate response
 * @param name Prompt name
 * @param args Optional arguments provided for the prompt
 * @returns Prompt result with messages
 */
// Tools will be added by the server code at runtime
const emptyToolsArray: ToolObject[] = []

export async function handlePrompt(
  name: string,
  args?: Record<string, string>,
): Promise<PromptResult> {
  let result: PromptResult

  // Handle GraphQL-related prompts only
  if (name in graphqlHandlers) {
    result = graphqlHandlers[name as keyof typeof graphqlHandlers](args)
  } else {
    throw new Error(`Unknown prompt: ${name}`)
  }

  // Tools will be added by the server code
  result.tools = emptyToolsArray

  return result
}
