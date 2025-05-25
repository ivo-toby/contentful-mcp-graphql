import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { validateEnvironment } from "../../src/utils/validation"

describe("validation utilities", () => {
  let originalEnv: NodeJS.ProcessEnv
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let exitSpy: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let consoleErrorSpy: any

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env }

    // Mock process.exit and console.error
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called")
    })
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv

    // Restore mocks
    exitSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("validateEnvironment", () => {
    it("passes validation with valid delivery token", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"

      expect(() => validateEnvironment()).not.toThrow()
      expect(exitSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    })

    it("fails validation without delivery token", () => {
      delete process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN

      expect(() => validateEnvironment()).toThrow("process.exit called")
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "CONTENTFUL_DELIVERY_ACCESS_TOKEN must be set for GraphQL operations",
      )
    })

    it("passes validation with HTTP server disabled", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "false"

      expect(() => validateEnvironment()).not.toThrow()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it("passes validation with HTTP server enabled and valid port", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"
      process.env.HTTP_PORT = "3000"

      expect(() => validateEnvironment()).not.toThrow()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it("passes validation with HTTP server enabled and no port specified", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"
      delete process.env.HTTP_PORT

      expect(() => validateEnvironment()).not.toThrow()
      expect(exitSpy).not.toHaveBeenCalled()
    })

    it("fails validation with HTTP server enabled and invalid port", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"
      process.env.HTTP_PORT = "invalid"

      expect(() => validateEnvironment()).toThrow("process.exit called")
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "HTTP_PORT must be a valid port number (1-65535)",
      )
    })

    it("fails validation with HTTP server enabled and port out of range (too low)", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"
      process.env.HTTP_PORT = "0"

      expect(() => validateEnvironment()).toThrow("process.exit called")
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "HTTP_PORT must be a valid port number (1-65535)",
      )
    })

    it("fails validation with HTTP server enabled and port out of range (too high)", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"
      process.env.HTTP_PORT = "65536"

      expect(() => validateEnvironment()).toThrow("process.exit called")
      expect(exitSpy).toHaveBeenCalledWith(1)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "HTTP_PORT must be a valid port number (1-65535)",
      )
    })

    it("passes validation with HTTP server enabled and edge case ports", () => {
      process.env.CONTENTFUL_DELIVERY_ACCESS_TOKEN = "test-token"
      process.env.ENABLE_HTTP_SERVER = "true"

      // Test minimum valid port
      process.env.HTTP_PORT = "1"
      expect(() => validateEnvironment()).not.toThrow()

      // Test maximum valid port
      process.env.HTTP_PORT = "65535"
      expect(() => validateEnvironment()).not.toThrow()
    })
  })
})
