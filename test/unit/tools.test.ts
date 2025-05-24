import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { getSpaceEnvProperties } from "../../src/types/tools.js"

describe("getSpaceEnvProperties", () => {
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

  it("should always add spaceId property and make it required", () => {
    const config = {
      type: "object",
      properties: {
        existingProperty: { type: "string" },
      },
      required: ["existingProperty"],
    }

    const result = getSpaceEnvProperties(config)

    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).toContain("existingProperty")
    expect(result.required).toContain("spaceId")
    // environmentId should not be required (it has a default)
    expect(result.required).not.toContain("environmentId")
  })

  it("should always add spaceId property even when environment variables are set", () => {
    process.env.SPACE_ID = "test-space"
    process.env.ENVIRONMENT_ID = "test-env"

    const config = {
      type: "object",
      properties: {
        existingProperty: { type: "string" },
      },
      required: ["existingProperty"],
    }

    const result = getSpaceEnvProperties(config)

    // spaceId should always be added and required for explicit parameter passing
    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).toContain("spaceId")
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

    const result = getSpaceEnvProperties(config)

    expect(result.properties).toHaveProperty("existingProperty")
    expect(result.properties).toHaveProperty("spaceId")
    expect(result.properties).toHaveProperty("environmentId")
    expect(result.required).toContain("existingProperty")
    expect(result.required).toContain("spaceId")
    // environmentId should not be required (it has a default)
    expect(result.required).not.toContain("environmentId")
  })
})
