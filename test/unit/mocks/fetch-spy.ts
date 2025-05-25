import { vi } from "vitest"

/**
 * Set up spy for fetch that passes through to the real implementation
 * This allows tests to verify fetch was called with specific arguments
 * while still allowing MSW to intercept the requests
 */
export function setupFetchSpy() {
  // Create a simple pass-through spy
  const fetchSpy = vi.fn((input, init) => {
    // Just log the request for debugging
    console.log("Mock fetch called with:", input, init ? JSON.stringify(init) : "")
    // @ts-ignore: The real fetch will be called via MSW
    return global.fetch(input, init)
  })

  // Replace global fetch with our spy
  vi.stubGlobal("fetch", fetchSpy)

  return fetchSpy
}

/**
 * Reset all fetch spies
 */
export function resetFetchSpy() {
  vi.restoreAllMocks()
}
