# Testing Strategy

This document outlines the updated testing approach for the Contentful GraphQL MCP Server.

## Directory Structure

- **test/unit/**

  - Pure unit tests that exercise internal logic (e.g., `smartSearch` field detection, `buildSearchQuery` generators).
  - No HTTP/network interactions; use simple mocks for helper functions.

- **test/component/**

  - Component-level tests for GraphQL handlers and server transports.
  - Use MSW (Mock Service Worker) to intercept and mock external HTTP requests to Contentful.
  - Focus on high-level flows: cache loading, smart search, query building, HTTP/SSE server routes.

- **test/integration/**
  - True end-to-end tests against a running MCP server instance.
  - Spin up the server in HTTP or stdio mode and communicate via real HTTP/SSE or stdio streams.
  - Validate end-to-end JSON message formats and appropriate outputs.

## MSW Setup

Mock Service Worker (MSW) is configured to intercept HTTP requests to the Contentful GraphQL API:

1. **Centralized Handlers**: All GraphQL handlers are defined in `test/msw-handlers.ts`, which handles requests like:

   - Introspection queries for content type discovery
   - Type queries for schema details
   - Search queries

2. **Fixture-Based Data**: Mock responses are stored in the `test/fixtures/` directory:

   - `introspection.json`: Content type discovery response
   - `page-article-schema.json`: Schema for PageArticle content type
   - `page-article-search.json`: Search results for PageArticle queries

3. **Test Setup**: MSW is automatically initialized in `test/setup.ts`:
   - Server starts in `beforeAll()`
   - Handlers reset after each test
   - Server shuts down in `afterAll()`

## Test Cache Initialization

To simplify tests and avoid repetitive HTTP call mocking, we provide helper functions for initializing the cache:

```typescript
// Import cache initialization helpers
import { initializeTestCache } from "./unit/mocks/cache-init"

// Initialize cache with test data in your test
beforeEach(() => {
  initializeTestCache()
})
```

## Writing Unit Tests

Unit tests should:

1. **Focus on a Single Unit**: Test one function or small group of related functions.
2. **Use Mocks Sparingly**: Only mock direct dependencies, not entire subsystems.
3. **Avoid HTTP Calls**: Never make real network requests; use the provided mock helpers.

Example:

```typescript
import { describe, it, expect } from "vitest"
import { isSearchableTextField } from "../../src/handlers/graphql-handlers"

describe("Utility Functions", () => {
  describe("isSearchableTextField", () => {
    it("should return true for String types", () => {
      expect(isSearchableTextField("String")).toBe(true)
      expect(isSearchableTextField("String!")).toBe(true)
    })

    it("should return false for non-String types", () => {
      expect(isSearchableTextField("Int")).toBe(false)
      expect(isSearchableTextField("Boolean")).toBe(false)
    })
  })
})
```

## Writing Component Tests

Component tests should:

1. **Test Full Flows**: Test entire workflows (e.g., cache loading → search query building → executing search).
2. **Use MSW for HTTP**: Let MSW intercept HTTP requests; don't manually mock `fetch`.
3. **Check High-Level Outputs**: Verify response formats and content, not implementation details.

Example:

```typescript
import { describe, it, expect } from "vitest"
import { loadContentfulMetadata, graphqlHandlers } from "../../src/handlers/graphql-handlers"

describe("Smart Search Flow", () => {
  it("should complete the full cache and search workflow", async () => {
    // Load cache (MSW will intercept the HTTP requests)
    await loadContentfulMetadata("test-space", "master", "test-token")

    // Execute smart search
    const result = await graphqlHandlers.smartSearch({ query: "address" })

    // Verify result format
    expect(result.isError).toBeFalsy()
    const response = JSON.parse(result.content[0].text)
    expect(response.results).toBeInstanceOf(Array)
    expect(response.totalContentTypesSearched).toBeGreaterThan(0)
  })
})
```

## Current State & Next Steps

Our test refactoring is in progress. Here's the current status:

1. **✅ Directory Structure**: Separated tests into unit, component, and integration categories.
2. **✅ MSW Setup**: Configured MSW for intercepting HTTP requests to Contentful.
3. **✅ Fixture-Based Data**: Created centralized mock data fixtures.
4. **🚧 Cache Initialization**: Created initial implementation but needs further work.
5. **🚧 Fetch Spying**: Need more reliable approach for tests that verify HTTP calls.
6. **❌ Test Adaptation**: Many tests still need updating to work with the new structure.

### High-Priority Issues

1. **Cache Initialization**: Our mock initialization approach needs refinement to reliably simulate a loaded cache.
2. **Fetch Spying**: Need a better solution for tests that verify HTTP call arguments while using MSW.
3. **Error Messages**: Many tests expect specific error messages that may have changed.

### Recommended Next Steps

1. Complete the `initializeTestCache()` implementation to reliably set up test state.
2. Update the fetch spy mechanism to properly record fetch calls without interfering with MSW.
3. Systematically update tests to match the new patterns, focusing on test value rather than implementation details.
4. Add integration tests that start a real server instance for true end-to-end testing.

## Migration Plan

For existing tests:

1. Move to the appropriate directory (unit/component/integration).
2. Remove manual `fetch` mocking in favor of MSW.
3. Update assertions to be more resilient to implementation changes.
4. Use the cache initialization helpers to set up test state.

For new tests:

1. Follow the patterns in this document.
2. Maintain a clear separation between unit, component, and integration tests.
3. Focus on testing behaviors and outputs, not implementation details.

---

With this structure, we achieve:

- **High fidelity** in component tests via MSW.
- **Fast, isolated** unit tests for core logic.
- **Comprehensive** E2E tests for real-world scenarios.

Refer to `vitest.config.ts` for patterns recognizing each test category.
