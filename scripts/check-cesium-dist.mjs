import assert from 'node:assert/strict'
import { readFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
assert.notEqual(pkg.private, true)
assert.equal(pkg.publishConfig.access, 'public')
assert.equal(pkg.types, './dist/cesium/index.d.ts')
assert.deepEqual(pkg.exports['.'], pkg.exports['./cesium'])
const api = await import(new URL('../dist/index.js', import.meta.url))
assert.equal(typeof api.ESPluginHost, 'function')
assert.equal('Viewer' in api, false)
assert.equal('VolumetricClouds' in api, false)
assert.equal('volumetricClouds' in api, false)
assert.equal(typeof api.ESClouds, 'function')
assert.equal(api.default.Clouds, api.ESClouds)
assert.equal(api.ES, api.default)
assert.equal(typeof api.esClouds, 'function')
const code = await readFile(resolve(root, 'dist/index.js'), 'utf8')
assert.match(code, /from ["']cesium["']/)
assert.doesNotMatch(code, /from ["'](?:three|@takram\/)/)
await readFile(resolve(root, 'dist/cesium/index.d.ts'), 'utf8')
await readFile(resolve(root, 'dist/engine.js'), 'utf8')
const water = await import(new URL('../dist/water.js', import.meta.url))
assert.equal(typeof water.WaterArea, 'function')
assert.deepEqual(pkg.exports['./engine/water'], { types: './dist/water/index.d.ts', import: './dist/water.js' })
await readFile(resolve(root, 'dist/water/index.d.ts'), 'utf8')
const waterCode = await readFile(resolve(root, 'dist/water.js'), 'utf8')
assert.match(waterCode, /createObjectURL/, 'WaterArea must contain an inline browser worker')
assert.doesNotMatch(waterCode, /assets\/worker-[A-Za-z0-9_-]+\.js/)
assert.doesNotMatch(waterCode, /workerpool|protomaps-leaflet/)
await readFile(resolve(root, 'third_party/licenses/upstream-MIT.txt'), 'utf8')
await readFile(resolve(root, 'third_party/licenses/three-runtime-assets-NOTICE.md'), 'utf8')
const assetManifest = JSON.parse(await readFile(resolve(root, 'dist/assets/earthscene/manifest.json'), 'utf8'))
const { earthsceneAssetUrls, earthsceneAssetFileNames } = await import('../dist/assets.js')
const assetDeclarations = await readFile(resolve(root, 'dist/assets.d.ts'), 'utf8')
assert.equal(assetManifest.name, pkg.name)
assert.deepEqual(Object.keys(assetManifest.assets), Object.keys(earthsceneAssetFileNames))
for (const assetUrl of Object.values(earthsceneAssetUrls)) {
  assert.match(assetUrl, /^data:[^,]+;base64,/, 'Built-in runtime assets must be self-contained by default.')
}
assert.doesNotMatch(assetDeclarations, /reference path=.*src\//, 'Published asset declarations must not reference repository sources.')
for (const asset of Object.values(assetManifest.assets)) {
  const { fileName } = asset
  assert((await stat(resolve(root, 'dist/assets/earthscene', fileName))).size > 0, `Missing package asset: ${fileName}`)
}
assert.equal(pkg.exports['./assets/manifest.json'], './dist/assets/earthscene/manifest.json')
assert.equal(pkg.exports['./assets/*'], './dist/assets/earthscene/*')
console.log('Cesium plugin entry, optional WaterArea entry/worker, types, renderer separation, and license checks passed.')
