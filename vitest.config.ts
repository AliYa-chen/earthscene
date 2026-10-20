import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/cesium/**/*.test.ts', 'src/water/**/*.test.ts', 'examples/**/*.test.ts'],
    globals: false
  }
})
