import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import {
  isBundledExternalModule,
  isPeerDependencyExternal
} from './src/build/peerDependencyExternal'

/**
 * 将必需运行资源内联，避免消费端预构建移动 import.meta.url 后丢失相对地址。
 * Inline required runtime assets so dependency prebundling cannot invalidate relative asset URLs.
 */
function inlineRuntimeAssets(): Plugin {
  const require = createRequire(import.meta.url)
  return {
    name: 'earthscene-inline-runtime-assets',
    enforce: 'pre',
    resolveId(id, importer) {
      if (!id.endsWith('?inline')) return null
      const specifier = id.slice(0, -'?inline'.length)
      const path = specifier.startsWith('.')
        ? resolve(dirname(importer?.split('?')[0] ?? ''), specifier)
        : require.resolve(specifier)
      return `${path}?inline-runtime`
    },
    load(id) {
      if (!id.endsWith('?inline-runtime')) return null
      const path = id.slice(0, -'?inline-runtime'.length)
      const extension = path.slice(path.lastIndexOf('.') + 1)
      const contentType = ({ png: 'image/png', jpg: 'image/jpeg', js: 'text/javascript' } as Record<string, string>)[extension] ?? 'application/octet-stream'
      const url = `data:${contentType};base64,${readFileSync(path).toString('base64')}`
      return `export default ${JSON.stringify(url)}`
    }
  }
}

function assertPeerDependenciesExternal(): Plugin {
  return {
    name: 'earthscene-assert-peer-dependencies-external',
    generateBundle(_options, bundle) {
      const bundledPeerModules = new Set<string>()

      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue

        for (const moduleId of Object.keys(output.modules)) {
          if (moduleId.endsWith('?inline-runtime')) continue
          if (isBundledExternalModule(moduleId)) {
            bundledPeerModules.add(moduleId)
          }
        }
      }

      if (bundledPeerModules.size > 0) {
        this.error(
          `Peer dependencies were bundled unexpectedly:\n${[...bundledPeerModules].join('\n')}`
        )
      }
    }
  }
}

export default defineConfig({
  base: './',
  plugins: [inlineRuntimeAssets(), assertPeerDependenciesExternal()],
  assetsInclude: ['**/*.bin'],
  optimizeDeps: {
    include: ['@mapbox/vector-tile', 'pbf']
  },
  worker: { format: 'es' },
  build: {
    lib: {
      entry: {
        index: 'src/cesium/index.ts',
        engine: 'src/index.ts',
        assets: 'src/assets.ts',
        water: 'src/water/index.ts'
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    sourcemap: true,
    rollupOptions: {
      external: (id) => !id.endsWith('?inline') && isPeerDependencyExternal(id)
    }
  }
})
