import { describe, it, expect } from 'vitest'

// Helper functions for testing
function isScalarType(typeString: string): boolean {
  const scalarTypes = ["String", "Int", "Float", "Boolean", "ID", "DateTime", "JSON"]
  return scalarTypes.some((scalar) => typeString.includes(scalar))
}

function isSearchableTextField(typeString: string): boolean {
  // Text fields that support _contains search
  return typeString.includes("String") && !typeString.includes("!")
}

function isReferenceType(typeString: string): boolean {
  // Exclude scalar types, collections, connections, etc.
  return (
    !isScalarType(typeString) &&
    !typeString.includes("Collection") &&
    !typeString.includes("Connection")
  )
}

function formatGraphQLType(typeInfo: any): string {
  if (!typeInfo) return "Unknown"

  if (typeInfo.kind === "NON_NULL") {
    return `${formatGraphQLType(typeInfo.ofType)}!`
  } else if (typeInfo.kind === "LIST") {
    return `[${formatGraphQLType(typeInfo.ofType)}]`
  } else if (typeInfo.name) {
    return typeInfo.name
  } else if (typeInfo.ofType && typeInfo.ofType.name) {
    return typeInfo.ofType.name
  }

  return "Unknown"
}

describe('Helper Functions', () => {
  describe('isScalarType', () => {
    it('should identify scalar types correctly', () => {
      expect(isScalarType('String')).toBe(true)
      expect(isScalarType('String!')).toBe(true)
      expect(isScalarType('Int')).toBe(true)
      expect(isScalarType('Float')).toBe(true)
      expect(isScalarType('Boolean')).toBe(true)
      expect(isScalarType('ID')).toBe(true)
      expect(isScalarType('DateTime')).toBe(true)
      expect(isScalarType('JSON')).toBe(true)
    })

    it('should reject non-scalar types', () => {
      expect(isScalarType('PageArticle')).toBe(false)
      expect(isScalarType('Asset')).toBe(false)
      expect(isScalarType('ContentfulMetadata')).toBe(false)
      expect(isScalarType('Sys')).toBe(false)
    })
  })

  describe('isSearchableTextField', () => {
    it('should identify searchable text fields', () => {
      expect(isSearchableTextField('String')).toBe(true)
      expect(isSearchableTextField('[String]')).toBe(true)
    })

    it('should reject non-searchable fields', () => {
      expect(isSearchableTextField('String!')).toBe(false) // Required fields not searchable
      expect(isSearchableTextField('Int')).toBe(false)
      expect(isSearchableTextField('Boolean')).toBe(false)
      expect(isSearchableTextField('DateTime')).toBe(false)
      expect(isSearchableTextField('PageArticle')).toBe(false)
    })
  })

  describe('isReferenceType', () => {
    it('should identify reference types', () => {
      expect(isReferenceType('PageArticle')).toBe(true)
      expect(isReferenceType('Asset')).toBe(true)
      expect(isReferenceType('TopicCategory')).toBe(true)
    })

    it('should reject scalar types', () => {
      expect(isReferenceType('String')).toBe(false)
      expect(isReferenceType('Int')).toBe(false)
      expect(isReferenceType('Boolean')).toBe(false)
    })

    it('should reject collection types', () => {
      expect(isReferenceType('PageArticleCollection')).toBe(false)
      expect(isReferenceType('AssetCollection')).toBe(false)
    })

    it('should reject connection types', () => {
      expect(isReferenceType('PageArticleConnection')).toBe(false)
    })
  })

  describe('formatGraphQLType', () => {
    it('should format simple types', () => {
      expect(formatGraphQLType({ name: 'String' })).toBe('String')
      expect(formatGraphQLType({ name: 'Int' })).toBe('Int')
    })

    it('should format non-null types', () => {
      const nonNullType = {
        kind: 'NON_NULL',
        ofType: { name: 'String' }
      }
      expect(formatGraphQLType(nonNullType)).toBe('String!')
    })

    it('should format list types', () => {
      const listType = {
        kind: 'LIST',
        ofType: { name: 'String' }
      }
      expect(formatGraphQLType(listType)).toBe('[String]')
    })

    it('should format nested types', () => {
      const nestedType = {
        kind: 'NON_NULL',
        ofType: {
          kind: 'LIST',
          ofType: { name: 'String' }
        }
      }
      expect(formatGraphQLType(nestedType)).toBe('[String]!')
    })

    it('should handle types with ofType.name fallback', () => {
      const typeWithOfType = {
        ofType: { name: 'PageArticle' }
      }
      expect(formatGraphQLType(typeWithOfType)).toBe('PageArticle')
    })

    it('should handle unknown types', () => {
      expect(formatGraphQLType(null)).toBe('Unknown')
      expect(formatGraphQLType(undefined)).toBe('Unknown')
      expect(formatGraphQLType({})).toBe('Unknown')
    })
  })
})
