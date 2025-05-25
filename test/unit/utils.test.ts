import { describe, it, expect } from "vitest"
import {
  formatGraphQLType,
  isScalarType,
  isSearchableTextField,
  isReferenceType,
} from "../../src/handlers/graphql-handlers"

describe("Utility Functions", () => {
  describe("formatGraphQLType", () => {
    it("should return name for scalar types", () => {
      expect(formatGraphQLType({ kind: "SCALAR", name: "String" })).toBe("String")
    })

    it("should format NON_NULL types", () => {
      const typeInfo = { kind: "NON_NULL", ofType: { kind: "SCALAR", name: "Int" } }
      expect(formatGraphQLType(typeInfo)).toBe("Int!")
    })

    it("should format LIST types", () => {
      const typeInfo = { kind: "LIST", ofType: { kind: "SCALAR", name: "Boolean" } }
      expect(formatGraphQLType(typeInfo)).toBe("[Boolean]")
    })

    it("should format nested types", () => {
      const nested = {
        kind: "NON_NULL",
        ofType: { kind: "LIST", ofType: { kind: "SCALAR", name: "String" } },
      }
      expect(formatGraphQLType(nested)).toBe("[String]!")
    })

    it("should handle unknown types gracefully", () => {
      expect(formatGraphQLType(null)).toBe("Unknown")
      expect(formatGraphQLType({})).toBe("Unknown")
    })
  })

  describe("isScalarType", () => {
    it("should identify built-in scalar types", () => {
      expect(isScalarType("String")).toBe(true)
      expect(isScalarType("Boolean")).toBe(true)
      expect(isScalarType("JSON")).toBe(true)
    })

    it("should reject non-scalar types", () => {
      expect(isScalarType("SomeObject")).toBe(false)
      expect(isScalarType("Date")).toBe(false)
    })
  })

  describe("isSearchableTextField", () => {
    it("should return true for String type", () => {
      expect(isSearchableTextField("String")).toBe(true)
    })

    it("should return false for non-String types", () => {
      expect(isSearchableTextField("Int")).toBe(false)
      expect(isSearchableTextField("String! ")).toBe(false)
    })
  })

  describe("isReferenceType", () => {
    it("should return true for types that are not scalar or collections", () => {
      expect(isReferenceType("Entry")).toBe(true)
    })

    it("should return false for scalar types", () => {
      expect(isReferenceType("String")).toBe(false)
    })

    it("should return false for Collection or Connection types", () => {
      expect(isReferenceType("AssetCollection")).toBe(false)
      expect(isReferenceType("EntryConnection")).toBe(false)
    })
  })
})
