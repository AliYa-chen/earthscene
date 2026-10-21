import assert from 'node:assert/strict'
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'src/assets')
const target = resolve(root, 'dist/assets')
const require = createRequire(import.meta.url)
const threeRoot = resolve(dirname(require.resolve('three')), '..')
const runtimeAssets = resolve(target, 'earthscene')

await rm(target, { force: true, recursive: true })
await cp(source, target, { recursive: true })

const dependencies = [
  {
    source: resolve(threeRoot, 'examples/jsm/libs/draco'),
    target: resolve(runtimeAssets, 'draco'),
    files: ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm']
  },
  {
    source: resolve(threeRoot, 'examples/jsm/libs/basis'),
    target: resolve(runtimeAssets, 'basis'),
    files: ['basis_transcoder.js', 'basis_transcoder.wasm']
  },
  {
    source: resolve(root, 'src/water/assets'),
    target: resolve(runtimeAssets, 'water'),
    files: ['Water_1_M_Normal.jpg', 'Water_2_M_Normal.jpg']
  }
]

for (const dependency of dependencies) {
  await mkdir(dependency.target, { recursive: true })
  for (const file of dependency.files) {
    await cp(resolve(dependency.source, file), resolve(dependency.target, file))
    assert((await stat(resolve(dependency.target, file))).size > 0, `Missing EarthScene runtime asset: ${file}`)
  }
}

const { earthsceneAssetFileNames } = await import('../dist/assets.js')
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const manifest = {
  name: packageJson.name,
  version: packageJson.version,
  description: 'EarthScene runtime assets. Runtime URLs are inlined into the JavaScript modules by default.',
  assets: Object.fromEntries(Object.entries(earthsceneAssetFileNames).map(([name, fileName]) => [name, {
    fileName,
    packaged: true
  }]))
}
await writeFile(resolve(runtimeAssets, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
