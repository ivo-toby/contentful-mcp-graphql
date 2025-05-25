import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getOptionalEnvProperties } from "../../src/types/tools.js"

describe("getOptionalEnvProperties", () => {
  beforeEach(() => {
    // Clear environment variables
    delete process.env.SPACE_ID
    delete process.env.ENVIRONMENT_ID
  })

  afterEach(() => {
    // Clean up environment variables
    delete process.env.SPACE_ID
    delete process.env.ENVIRONMENT_ID
  })

  it("should add optional spaceId and environmentId properties", () => {
    const config = {
      type: "object",
      properties: {
        existingProperty: { type: "string" },
      },
      required: ["existingProperty"],
    }

    const result = getOptionalEnvProperties(config)

    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).toContain("existingProperty")
    // Both spaceId and environmentId should be optional (not required)
    expect(result.required).not.toContain("spaceId")
    expect(result.required).not.toContain("environmentId")
  })

  it("should add optional properties even when environment variables are set", () => {
    process.env.SPACE_ID = "test-space"
    process.env.ENVIRONMENT_ID = "test-env"

    const config = {
      type: "object",
      properties: {
        existingProperty: { type: "string" },
      },
      required: ["existingProperty"],
    }

    const result = getOptionalEnvProperties(config)

    // spaceId and environmentId should be optional even when env vars are set
    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).not.toContain("spaceId")
    expect(result.required).not.toContain("environmentId")
  })

  it("should merge spaceId and environmentId properties with existing properties", () => {
    const config = {
      type: "object",
      properties: {
        existingProperty: { type: "string" },
      },
      required: ["existingProperty"],
    }

    const result = getOptionalEnvProperties(config)

    expect(result.properties).toHaveProperty("existingProperty")
    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).toContain("existingProperty")
    // Both spaceId and environmentId should be optional
    expect(result.required).not.toContain("spaceId")
    expect(result.required).not.toContain("environmentId")
  })
})
