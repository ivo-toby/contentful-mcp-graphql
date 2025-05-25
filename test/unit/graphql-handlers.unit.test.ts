import { describe, it, expect, beforeEach } from "vitest"
import {
  getCacheStatus,
  getCachedContentTypes,
  getCachedContentTypeSchema,
  isCacheAvailable,
  clearCache,
  formatGraphQLType,
  isScalarType,
  isSearchableTextField,
  isReferenceType,
} from "../../src/handlers/graphql-handlers"

describe("graphql-handlers cache functions", () => {
  beforeEach(() => {
    clearCache()
  })

  describe("cache status and availability", () => {
    it("returns unavailable cache status by default", () => {
      const status = getCacheStatus()
      expect(status.available).toBe(false)
      expect(status.contentTypesCount).toBe(0)
      expect(status.schemasCount).toBe(0)
      expect(status.lastUpdate).toBeNull()
    })

    it("isCacheAvailable returns false by default", () => {
      expect(isCacheAvailable()).toBe(false)
    })

    it("clearCache resets all cache state", () => {
      clearCache()
      expect(getCacheStatus().available).toBe(false)
      expect(getCachedContentTypes()).toBeNull()
      expect(isCacheAvailable()).toBe(false)
    })
  })

  describe("cached content types", () => {
    it("returns null when no content types are cached", () => {
      expect(getCachedContentTypes()).toBeNull()
    })

    it("returns null for content type schema when cache is empty", () => {
      expect(getCachedContentTypeSchema("PageArticle")).toBeNull()
      expect(getCachedContentTypeSchema("nonexistent")).toBeNull()
    })
  })
})

describe("graphql-handlers utility functions", () => {
  describe("formatGraphQLType", () => {
    it("formats simple scalar types", () => {
      expect(formatGraphQLType({ kind: "SCALAR", name: "String" })).toBe("String")
      expect(formatGraphQLType({ kind: "SCALAR", name: "Int" })).toBe("Int")
    })

    it("formats non-null types", () => {
      expect(
        formatGraphQLType({
          kind: "NON_NULL",
          ofType: { kind: "SCALAR", name: "String" },
        }),
      ).toBe("String!")
    })

    it("formats list types", () => {
      expect(
        formatGraphQLType({
          kind: "LIST",
          ofType: { kind: "SCALAR", name: "String" },
        }),
      ).toBe("[String]")
    })

    it("formats complex nested types", () => {
      expect(
        formatGraphQLType({
          kind: "NON_NULL",
          ofType: {
            kind: "LIST",
            ofType: { kind: "SCALAR", name: "String" },
          },
        }),
      ).toBe("[String]!")
    })

    it("handles object types", () => {
      expect(formatGraphQLType({ kind: "OBJECT", name: "PageArticle" })).toBe("PageArticle")
    })

    it("handles unknown types gracefully", () => {
      expect(formatGraphQLType({})).toBe("Unknown")
      expect(formatGraphQLType(null)).toBe("Unknown")
      expect(formatGraphQLType(undefined)).toBe("Unknown")
    })
  })

  describe("isScalarType", () => {
    it("identifies scalar types correctly", () => {
      expect(isScalarType("String")).toBe(true)
      expect(isScalarType("Int")).toBe(true)
      expect(isScalarType("Float")).toBe(true)
      expect(isScalarType("Boolean")).toBe(true)
      expect(isScalarType("ID")).toBe(true)
      expect(isScalarType("DateTime")).toBe(true)
      expect(isScalarType("JSON")).toBe(true)
    })

    it("identifies non-scalar types correctly", () => {
      expect(isScalarType("PageArticle")).toBe(false)
      expect(isScalarType("TopicCategory")).toBe(false)
      expect(isScalarType("[String]")).toBe(true)
      expect(isScalarType("String!")).toBe(true)
      expect(isScalarType("")).toBe(false)
    })
  })

  describe("isSearchableTextField", () => {
    it("identifies searchable text fields correctly", () => {
      expect(isSearchableTextField("String")).toBe(true)
    })

    it("identifies non-searchable fields correctly", () => {
      expect(isSearchableTextField("String!")).toBe(false)
      expect(isSearchableTextField("[String]")).toBe(false)
      expect(isSearchableTextField("[String]!")).toBe(false)
      expect(isSearchableTextField("[String!]")).toBe(false)
      expect(isSearchableTextField("Int")).toBe(false)
      expect(isSearchableTextField("Float")).toBe(false)
      expect(isSearchableTextField("Boolean")).toBe(false)
      expect(isSearchableTextField("DateTime")).toBe(false)
      expect(isSearchableTextField("PageArticle")).toBe(false)
      expect(isSearchableTextField("")).toBe(false)
    })
  })

  describe("isReferenceType", () => {
    it("identifies reference types correctly", () => {
      expect(isReferenceType("PageArticle")).toBe(true)
      expect(isReferenceType("TopicCategory")).toBe(true)
      expect(isReferenceType("Asset")).toBe(true)
      expect(isReferenceType("[PageArticle]")).toBe(true)
      expect(isReferenceType("PageArticle!")).toBe(true)
      expect(isReferenceType("[PageArticle]!")).toBe(true)
    })

    it("identifies non-reference types correctly", () => {
      expect(isReferenceType("String")).toBe(false)
      expect(isReferenceType("Int")).toBe(false)
      expect(isReferenceType("Boolean")).toBe(false)
      expect(isReferenceType("DateTime")).toBe(false)
      expect(isReferenceType("JSON")).toBe(false)
      expect(isReferenceType("PageArticleCollection")).toBe(false)
      expect(isReferenceType("PageArticleConnection")).toBe(false)
      expect(isReferenceType("")).toBe(true)
    })
  })
})
