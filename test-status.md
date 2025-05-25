# Test Status Report

## Overview

This document reviews the current integration tests under `test/integration` in light of the features described in `README.md` and `SMART_QUERY.md`. It evaluates whether the tests align with best practices for integration testing and offers recommendations for simplification and maintainability.

## Findings

1. **Excessive Mocking of `fetch`**

   - All integration tests stub `fetch` globally with intricate mock responses for schema introspection and data queries.
   - Repetitive setup of mock responses across multiple tests leads to boilerplate code and increases brittleness when the GraphQL schema evolves.

2. **Mixed Concerns in Single Suites**

   - Individual test files combine cache initialization, smart search functionality, query building, and handler fallbacks in the same suite.
   - This overlaps unit-level logic (e.g., field detection) with higher-level flows, making tests harder to reason about and maintain.

3. **Large Test Files with High Cognitive Load**

   - Files in `test/integration` range from ~250 to 325 lines, with extensive JSON literals and deep `expect` chains.
   - Test assertions peek into internal details (e.g., checking specific `OR` clause syntax), which is more appropriate for unit tests.

4. **Misaligned with True Integration Testing**

   - Despite being labeled "integration," these tests do not spin up a real HTTP/SSE server or call an actual Contentful endpoint.
   - Instead, they mock every network interaction, effectively functioning as complex unit tests.

5. **Maintenance Challenges**
   - Any change in the GraphQL schema (field additions, renaming) requires manual updates to numerous mock objects across multiple files.
   - Mock data duplication increases the risk of inconsistencies and slows down test updates.

## Recommendations

- **Introduce Shared Fixtures**: Extract common mock responses (schema introspection and sample data) into centralized fixtures or helper functions.

- **Split Test Responsibilities**:

  - Reserve integration tests for end-to-end flows (e.g., spinning up the HTTP transport layer and invoking handlers via real requests).
  - Move detailed field-detection and query string assertions into smaller unit tests focusing on `smartSearch` and `buildSearchQuery` logic.

- **Adopt Lightweight HTTP Stubbing with MSW**:

  - Install `msw` and its Node adapter: `npm install --save-dev msw`.
  - Define reusable handlers in `test/msw-handlers.ts` for GraphQL introspection (`POST /graphql`) and search endpoints.
  - In `vitest.setup.ts`, import the handlers and call `setupServer(...handlers)` to start/stop the MSW server in global hooks.
  - Remove manual `vi.stubGlobal("fetch")` calls; rely on MSW to intercept and mock HTTP requests to Contentful.
  - Benefits: centralized fixtures, DRY mocking, and more realistic HTTP behavior.

- **Simplify Assertions**:

  - In integration suites, validate high-level outcomes (success/error, number of results) instead of inspecting full query strings.

- **Re-label True Integration Tests**:

  - Rename existing "integration" tests that fully mock `fetch` to "unit" or "component" tests.
  - Create a lean set of true integration tests that verify the MCP server's transport and handler wiring against a running instance.

- **Leverage Parameterized Tests**:

  - Where repeated logic is tested across multiple content types, use parameterized (`describe.each`) tests to reduce duplication.

- **Automate Schema Fixture Generation**:
  - Consider a build step to generate stable, minimal introspection fixtures from a real Contentful space, to keep mocks up to date.

---

_By consolidating fixtures, clarifying test boundaries, and focusing on high-level flows, we can reduce complexity, improve maintainability, and ensure the tests remain aligned with the actual behavior of the MCP server._

## Refactoring Plan

1. **Add MSW for HTTP Stubbing**

   - Install MSW and its Node adapter: `npm install --save-dev msw`.
   - Create `test/msw-handlers.ts` exporting handlers for:
     - GraphQL introspection (`POST /graphql`, returning content type list and schemas)
     - Search queries for each content type
   - Configure Vitest to start MSW in `vitest.setup.ts`:
     ```ts
     import { setupServer } from "msw/node"
     import { handlers } from "./test/msw-handlers"
     const server = setupServer(...handlers)
     beforeAll(() => server.listen())
     afterEach(() => server.resetHandlers())
     afterAll(() => server.close())
     ```

2. **Centralize Fixtures**

   - Move all mock responses into `test/fixtures/`, e.g.:
     - `fixtures/introspection.json`
     - `fixtures/page-article-schema.json`
     - `fixtures/topic-category-schema.json`
     - `fixtures/search-results.json`
   - Import these fixtures in `msw-handlers.ts` to keep data DRY.

3. **Reorganize Test Suites**

   - **Unit Tests** (`test/unit/`):
     - Test pure logic in `smartSearch` and `buildSearchQuery`:
       - Field detection, OR-clause construction, variable binding
     - Use `describe.each` to parameterize tests across content types.
   - **Component Tests** (`test/component/`):
     - Refactor existing `test/integration/*.test.ts` that mock via MSW but call handlers directly.
     - Rename files to `*.component.test.ts` to reflect scope.
     - Remove all `vi.stubGlobal('fetch')` calls; rely on MSW.
   - **True Integration-e2e Tests** (`test/integration/`):
     - Spin up the MCP server in HTTP/SSE mode using `npm run dev -- --http` or programmatically.
     - Use `fetch` or `supertest` to call the HTTP endpoint.
     - Verify high-level JSON responses (success status, result counts, cached flags).

4. **Simplify Assertions**

   - In component/e2e tests, assert on top-level response structure and key fields only.
   - Move detailed query-string and field list assertions into unit tests.

5. **Update Test Configuration**

   - Add `setupFiles: ['vitest.setup.ts']` in `vitest.config.ts`.
   - Adjust `testMatch` patterns to recognize `.unit.test.ts`, `.component.test.ts`, and `.test.ts` in integration.

6. **Document New Test Strategy**
   - Update `README.md` or create `TESTING.md` with:
     - New directory structure
     - MSW setup instructions
     - Guidelines for writing unit, component, and e2e tests

---

_This plan will guide the step-by-step refactoring of our tests, reducing boilerplate, improving test fidelity, and clarifying test responsibilities._
