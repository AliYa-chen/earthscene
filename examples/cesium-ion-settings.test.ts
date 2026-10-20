import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CESIUM_ION_TOKEN_STORAGE_KEY,
  getCesiumIonToken,
  setCesiumIonToken,
} from "./cesium-ion-settings"

const memory = new Map<string, string>()

afterEach(() => {
  memory.clear()
  vi.unstubAllEnvs()
})

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem(key: string) {
      return memory.get(key) ?? null
    },
    setItem(key: string, value: string) {
      memory.set(key, value)
    },
    removeItem(key: string) {
      memory.delete(key)
    },
  },
})

describe("cesium ion token storage", () => {
  it("returns empty when nothing is stored", () => {
    vi.stubEnv("VITE_CESIUM_ION_TOKEN", "")
    expect(getCesiumIonToken()).toBe("")
  })

  it("trims and persists a token", () => {
    setCesiumIonToken("  abc.def  ")
    expect(getCesiumIonToken()).toBe("abc.def")
    expect(memory.get(CESIUM_ION_TOKEN_STORAGE_KEY)).toBe("abc.def")
  })

  it("clears storage for an empty value", () => {
    vi.stubEnv("VITE_CESIUM_ION_TOKEN", "")
    setCesiumIonToken("keep")
    setCesiumIonToken("   ")
    expect(getCesiumIonToken()).toBe("")
    expect(memory.has(CESIUM_ION_TOKEN_STORAGE_KEY)).toBe(false)
  })

  it("uses the environment default and allows a browser override", () => {
    vi.stubEnv("VITE_CESIUM_ION_TOKEN", "  example-default  ")
    expect(getCesiumIonToken()).toBe("example-default")
    setCesiumIonToken("personal-override")
    expect(getCesiumIonToken()).toBe("personal-override")
    setCesiumIonToken("")
    expect(getCesiumIonToken()).toBe("example-default")
  })

  it("keeps the environment default when browser storage is unavailable", () => {
    vi.stubEnv("VITE_CESIUM_ION_TOKEN", "example-default")
    const getItem = vi.spyOn(globalThis.localStorage, "getItem")
      .mockImplementation(() => { throw new Error("Storage unavailable") })
    expect(getCesiumIonToken()).toBe("example-default")
    getItem.mockRestore()
  })
})
