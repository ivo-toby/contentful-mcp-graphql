# Testing Strategy

This document outlines the testing approach for the Contentful GraphQL MCP Server.

## Current Approach

We use a **lightweight unit testing approach** focused on:

1. **Testing Public API Only**: Only test functions that are actually exported and used
2. **Minimal Dependencies**: Avoid complex mocking setups that are brittle
3. **Fast Execution**: Unit tests should run quickly and reliably
4. **Clear Assertions**: Each test should have a single, clear purpose

## Directory Structure

```
test/
├── unit/                       # Lightweight unit tests
│   ├── graphql-handlers.unit.test.ts
│   ├── validation.unit.test.ts
│   ├── tools.unit.test.ts
│   └── streamable-http.unit.test.ts
├── setup.ts                    # Test configuration
└── README.md                   # Detailed test documentation
```

## Test Infrastructure

- **Vitest**: Modern test runner with TypeScript support
- **Simple Mocking**: Using Vitest's built-in mocking capabilities
- **Environment Setup**: Automatic test environment configuration

## Current Test Coverage

- ✅ **Cache Management** (17 tests): Cache status, content types, clearing
- ✅ **Utility Functions** (17 tests): GraphQL type formatting, field detection
- ✅ **Environment Validation** (9 tests): Environment variable validation, port validation
- ✅ **Tool Configuration** (13 tests): Schema generation, tool definitions
- ✅ **StreamableHTTP Server** (6 tests): Server setup, routing, request handling

**Total: 45 passing tests**

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test test/unit/graphql-handlers.unit.test.ts
```

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from "vitest"
import { isScalarType } from "../../src/handlers/graphql-handlers"

describe("isScalarType", () => {
  it("identifies scalar types correctly", () => {
    expect(isScalarType("String")).toBe(true)
    expect(isScalarType("Int")).toBe(true)
    expect(isScalarType("Boolean")).toBe(true)
  })

  it("identifies non-scalar types correctly", () => {
    expect(isScalarType("PageArticle")).toBe(false)
    expect(isScalarType("TopicCategory")).toBe(false)
  })
})
```

### Environment Mocking Example

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"

describe("environment validation", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("validates required environment variables", () => {
    process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
    expect(() => validateEnvironment()).not.toThrow()
  })
})
```

## Future Expansion

When adding new tests, consider:

1. **Start Simple**: Begin with unit tests for pure functions
2. **Test Behavior**: Focus on what the function does, not how it does it
3. **Avoid Over-Mocking**: Only mock direct dependencies
4. **Keep Tests Fast**: Aim for tests that run in milliseconds

For more detailed information about the test structure and philosophy, see `test/README.md`.

---

This lightweight approach provides reliable test coverage while avoiding complexity and maintenance burden.
