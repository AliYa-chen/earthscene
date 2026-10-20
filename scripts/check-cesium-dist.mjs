import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
await readFile(resolve(root, 'third_party/licenses/upstream-MIT.txt'), 'utf8')
console.log('Cesium plugin entry, types, renderer separation, and license checks passed.')
