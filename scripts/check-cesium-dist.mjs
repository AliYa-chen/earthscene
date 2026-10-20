import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
assert.equal(pkg.private, true)
assert.equal(pkg.exports['./cesium'].types, './dist/cesium/index.d.ts')
const api = await import(new URL('../dist/cesium.js', import.meta.url))
assert.equal(typeof api.Viewer, 'function')
assert.equal(typeof api.VolumetricClouds, 'function')
assert.equal(api.default.Viewer, api.Viewer)
assert.equal(typeof api.volumetricClouds, 'function')
const code = await readFile(resolve(root, 'dist/cesium.js'), 'utf8')
assert.match(code, /from ["']cesium["']/)
assert.doesNotMatch(code, /from ["'](?:three|@takram\/)/)
await readFile(resolve(root, 'dist/cesium/index.d.ts'), 'utf8')
await readFile(resolve(root, 'dist/index.js'), 'utf8')
await readFile(resolve(root, 'third_party/licenses/upstream-MIT.txt'), 'utf8')
console.log('Cesium plugin entry, types, renderer separation, and license checks passed.')
