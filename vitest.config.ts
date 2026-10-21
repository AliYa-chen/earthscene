import { defineConfig } from 'vitest/config'
import buildConfig from './vite.config'

export default defineConfig({
  plugins: buildConfig.plugins,
  test: {
    environment: 'node',
    include: ['src/test/**/*.test.ts', 'src/cesium/**/*.test.ts', 'src/water/**/*.test.ts', 'examples/**/*.test.ts'],
    globals: false
  }
})
