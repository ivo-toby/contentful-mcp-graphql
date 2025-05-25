// @ts-nocheck
/* eslint-disable */

// @ts-ignore: msw provides rest at runtime
import { graphql } from "msw"
import introspection from "./fixtures/introspection.json"
import pageArticleSchema from "./fixtures/page-article-schema.json"
import topicCategorySchema from "./fixtures/topic-category-schema.json"
import pageArticleSearch from "./fixtures/page-article-search.json"
import topicCategorySearch from "./fixtures/topic-category-search.json"

// Handlers for GraphQL operations
export const handlers = [
  // Introspection Query (used by loadContentfulMetadata)
  graphql.query("IntrospectionQuery", (req, res, ctx) => {
    console.log("MSW: IntrospectionQuery intercepted")
    return res(ctx.data(introspection.data))
  }),

  // Specific type schema queries (used by loadContentfulMetadata)
  graphql.query("GetContentTypeDefinition", (req, res, ctx) => {
    console.log("MSW: GetContentTypeDefinition for", req.variables.contentType)
    if (req.variables.contentType === "PageArticle") {
      return res(ctx.data(pageArticleSchema.data))
    }
    if (req.variables.contentType === "TopicCategory") {
      return res(ctx.data(topicCategorySchema.data))
    }
    return res(
      ctx.status(404),
      ctx.errors([
        {
          message: `Mock for GetContentTypeDefinition not found for ${req.variables.contentType}`,
        },
      ]),
    )
  }),

  // Search queries (used by smartSearch)
  graphql.query("SearchPageArticle", (req, res, ctx) => {
    console.log("MSW: SearchPageArticle intercepted")
    return res(ctx.data(pageArticleSearch.data))
  }),
  graphql.query("SearchTopicCategory", (req, res, ctx) => {
    console.log("MSW: SearchTopicCategory intercepted")
    return res(ctx.data(topicCategorySearch.data))
  }),

  // Fallback for any other GraphQL operations
  graphql.operation((req, res, ctx) => {
    console.warn(`MSW: Unhandled GraphQL operation: ${req.operationName}`, req.variables)
    const query = req.query || ""

    // Attempt to match based on query content for common anonymous operations
    if (req.operationName === "IntrospectionQuery" || query.includes("__schema {")) {
      console.log("MSW Fallback: IntrospectionQuery")
      return res(ctx.data(introspection.data))
    }

    if (query.includes('__type(name: "PageArticle")')) {
      console.log("MSW Fallback: GetContentTypeDefinition PageArticle")
      return res(ctx.data(pageArticleSchema.data))
    }

    if (query.includes('__type(name: "TopicCategory")')) {
      console.log("MSW Fallback: GetContentTypeDefinition TopicCategory")
      return res(ctx.data(topicCategorySchema.data))
    }

    if (query.includes("pageArticleCollection")) {
      console.log("MSW Fallback: SearchPageArticle")
      return res(ctx.data(pageArticleSearch.data))
    }

    if (query.includes("topicCategoryCollection")) {
      console.log("MSW Fallback: SearchTopicCategory")
      return res(ctx.data(topicCategorySearch.data))
    }

    console.error(
      `MSW: No matching handler for GraphQL query: ${req.operationName || "anonymous"}`,
      query.substring(0, 200),
    )
    return res(
      ctx.status(500),
      ctx.json({
        errors: [
          {
            message: `MSW: No mock handler for GraphQL query: ${req.operationName || "anonymous"}`,
          },
        ],
      }),
    )
  }),
]
