import { cp, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cesium = dirname(require.resolve('cesium/package.json'))
const destination = resolve(root, 'examples/public/cesium')
await mkdir(destination, { recursive: true })
for (const name of ['Assets', 'Workers', 'Widgets', 'ThirdParty']) {
  await cp(resolve(cesium, 'Build/Cesium', name), resolve(destination, name), { recursive: true })
}
console.log('Cesium runtime assets copied into examples/public/cesium.')
