# Test Documentation

## Overview

This directory contains the test suite for the Contentful GraphQL MCP Server. We use a lightweight unit testing approach focused on testing public APIs with minimal dependencies.

## Philosophy

After experiencing issues with complex integration tests and module mocking, we adopted a **lightweight unit testing approach** that prioritizes:

1. **Reliability**: Tests that consistently pass and don't break due to implementation changes
2. **Speed**: Fast execution for quick feedback during development
3. **Simplicity**: Easy to understand and maintain test code
4. **Focus**: Testing behavior, not implementation details

## Directory Structure

```
test/
├── unit/                       # All unit tests
│   ├── graphql-handlers.unit.test.ts    # Cache and utility functions
│   ├── validation.unit.test.ts          # Environment validation
│   ├── tools.unit.test.ts               # Tool configuration
│   └── streamable-http.unit.test.ts     # HTTP server functionality
├── setup.ts                    # Global test configuration
└── README.md                   # This file
```

## Test Infrastructure

- **Vitest**: Modern test runner with excellent TypeScript support
- **Built-in Mocking**: Using Vitest's native mocking capabilities
- **Environment Variables**: Automatic setup of test environment

## Current Test Coverage

### graphql-handlers.unit.test.ts (17 tests)

- Cache management functions (`getCacheStatus`, `clearCache`, `isCacheAvailable`)
- GraphQL utility functions (`formatGraphQLType`, `isScalarType`, `isSearchableTextField`, `isReferenceType`)

### validation.unit.test.ts (9 tests)

- Environment variable validation logic
- HTTP port validation with edge cases
- Error handling and `process.exit` behavior

### tools.unit.test.ts (13 tests)

- Tool configuration schema generation
- GraphQL tool definitions and structure validation
- Environment property injection testing

### streamable-http.unit.test.ts (6 tests)

- StreamableHTTP server functionality
- Route setup and handler registration
- Server lifecycle management

**Total: 45 tests, all passing**

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test test/unit/graphql-handlers.unit.test.ts

# Run with coverage
npm run test:coverage
```

## Writing New Tests

### Basic Test Structure

```typescript
import { describe, it, expect } from "vitest"
import { functionToTest } from "../../src/path/to/module"

describe("functionToTest", () => {
  it("should do what it's supposed to do", () => {
    const result = functionToTest("input")
    expect(result).toBe("expected output")
  })
})
```

### Environment Variable Testing

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"

describe("environment dependent function", () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should work with valid environment", () => {
    process.env.REQUIRED_VAR = "test-value"
    expect(() => functionToTest()).not.toThrow()
  })
})
```

### Mocking Functions

```typescript
import { describe, it, expect, vi } from "vitest"

describe("function with dependencies", () => {
  it("should handle mocked dependency", () => {
    const mockFn = vi.fn().mockReturnValue("mocked result")
    const result = functionToTest(mockFn)
    expect(mockFn).toHaveBeenCalledWith("expected input")
    expect(result).toBe("expected output")
  })
})
```

## Guidelines

### What to Test

- ✅ Public API functions that are exported and used
- ✅ Error handling and edge cases
- ✅ Environment variable validation
- ✅ Configuration generation and validation

### What NOT to Test

- ❌ Private/internal functions not exported
- ❌ Implementation details that might change
- ❌ Third-party library behavior
- ❌ Complex integration scenarios (keep those simple)

### Best Practices

1. **One Assertion Per Test**: Each test should verify one specific behavior
2. **Descriptive Names**: Test names should clearly describe what's being tested
3. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
4. **Independent Tests**: Tests should not depend on each other
5. **Fast Execution**: Aim for tests that run in milliseconds

### Common Patterns

#### Testing Functions That Return Objects

```typescript
it("should return object with expected properties", () => {
  const result = generateConfig()
  expect(result).toHaveProperty("name")
  expect(result).toHaveProperty("description")
  expect(result.name).toBe("expected-name")
})
```

#### Testing Error Conditions

```typescript
it("should throw error for invalid input", () => {
  expect(() => validateInput("invalid")).toThrow("Expected error message")
})
```

#### Testing Async Functions

```typescript
it("should handle async operation", async () => {
  const result = await asyncFunction()
  expect(result).toBe("expected result")
})
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Make sure the path to the module is correct
2. **Environment Variables**: Use beforeEach/afterEach to properly set up and clean up
3. **Async Tests**: Don't forget to use `await` or return promises
4. **Mocking**: Use Vitest's `vi.fn()` for simple mocks

### Debugging Tests

```bash
# Run single test with verbose output
npm test -- --reporter=verbose test/unit/specific.test.ts

# Run tests with debugging
npm test -- --inspect-brk
```

## Future Considerations

As the codebase grows, consider:

1. **Test Utilities**: Create helper functions for common test patterns
2. **Custom Matchers**: Add domain-specific assertions
3. **Performance Tests**: Add tests for performance-critical functions
4. **Integration Tests**: Carefully add integration tests for critical workflows

Remember: The goal is reliable, fast tests that give confidence in the code without becoming a maintenance burden.
