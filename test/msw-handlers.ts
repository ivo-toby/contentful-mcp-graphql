// @ts-ignore: Allow import from msw for testing
import { rest } from "msw"
import introspection from "./fixtures/introspection.json"
import pageArticleSchema from "./fixtures/page-article-schema.json"
import topicCategorySchema from "./fixtures/topic-category-schema.json"
import pageArticleSearch from "./fixtures/page-article-search.json"
import topicCategorySearch from "./fixtures/topic-category-search.json"

// Base Contentful GraphQL endpoint (using default test-space-id and master environment)
const GRAPHQL_URL =
  "https://graphql.contentful.com/content/v1/spaces/test-space-id/environments/master"

export const handlers = [
  rest.post(GRAPHQL_URL, async (req: any, res: any, ctx: any) => {
    const body = (await req.json()) as { query: string }
    const query = body.query

    // Introspection: list content types
    if (query.includes("__schema")) {
      return res(ctx.status(200), ctx.json(introspection))
    }

    // Schema for PageArticle
    if (query.includes("__type") && query.includes("PageArticle")) {
      return res(ctx.status(200), ctx.json(pageArticleSchema))
    }

    // Schema for TopicCategory
    if (query.includes("__type") && query.includes("TopicCategory")) {
      return res(ctx.status(200), ctx.json(topicCategorySchema))
    }

    // Search for PageArticle
    if (query.includes("pageArticleCollection") && query.includes("_contains")) {
      return res(ctx.status(200), ctx.json(pageArticleSearch))
    }

    // Search for TopicCategory
    if (query.includes("topicCategoryCollection") && query.includes("_contains")) {
      return res(ctx.status(200), ctx.json(topicCategorySearch))
    }

    // Default empty response
    return res(ctx.status(200), ctx.json({ data: {} }))
  }),
]
