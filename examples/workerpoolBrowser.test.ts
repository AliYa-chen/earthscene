import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadConfigFromFile } from 'vite'

import { workerpoolBrowser } from './workerpoolBrowser'

function harness() {
  const plugin = workerpoolBrowser()
  return {
    resolveId: plugin.resolveId as (source: string, importer?: string) => string | null,
    load: plugin.load as (id: string) => string | null,
  }
}

const workerpoolImporter = '/project/node_modules/.pnpm/workerpool@10.0.3/node_modules/workerpool/dist/workerpool.js'

describe('workerpool browser backend isolation', () => {
  it.each(['worker_threads', 'os', 'child_process'])('isolates %s only inside workerpool', (builtin) => {
    const plugin = harness()
    const id = plugin.resolveId(builtin, workerpoolImporter)
    expect(id).toEqual(expect.any(String))
    expect(plugin.resolveId(`node:${builtin}`, workerpoolImporter)).toBe(id)
    expect(plugin.resolveId(builtin, 'C:\\project\\node_modules\\workerpool\\src\\WorkerHandler.js')).toBe(id)
    expect(plugin.load(id!)).toEqual(expect.any(String))

    for (const importer of [
      undefined,
      '/project/examples/app.ts',
      '/project/node_modules/another-library/index.js',
      '/project/node_modules/workerpool-extra/index.js',
      '/project/vendor/workerpool/dist/workerpool.js',
    ]) {
      expect(plugin.resolveId(builtin, importer)).toBeNull()
    }
  })

  it('leaves browser workers and all other imports to Vite', () => {
    const plugin = harness()
    for (const source of ['./worker.js', './environment', 'workerpool', 'fs', 'node:path', 'os-browserify']) {
      expect(plugin.resolveId(source, workerpoolImporter)).toBeNull()
    }
    expect(plugin.load('/project/examples/app.ts')).toBeNull()
    expect(plugin.load('\0earthscene:workerpool-browser:fs')).toBeNull()
  })

  it.each([
    ['os', 'cpus'],
    ['child_process', 'fork'],
    ['worker_threads', 'Worker'],
  ])('loads %s safely and fails immediately if its Node backend is invoked', async (builtin, method) => {
    const plugin = harness()
    const id = plugin.resolveId(builtin, workerpoolImporter)!
    const source = plugin.load(id)!
    const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
    const module = await import(/* @vite-ignore */ moduleUrl)

    expect(() => module[method]()).toThrow(`Node.js backend '${builtin}' is unavailable`)
    expect(() => module.default[method]()).toThrow("use workerType: 'web'")
    if (builtin === 'worker_threads') {
      expect(() => new module.Worker()).toThrow("Node.js backend 'worker_threads' is unavailable")
    }
  })

  it('installs isolation for both the page and worker builds', async () => {
    const loaded = await loadConfigFromFile(
      { command: 'build', mode: 'test' },
      fileURLToPath(new URL('./vite.config.ts', import.meta.url)),
    )
    expect(loaded).not.toBeNull()
    const expectedPlugin = expect.objectContaining({ name: 'earthscene-workerpool-browser' })
    expect(loaded!.config.plugins).toEqual(expect.arrayContaining([expectedPlugin]))
    expect(await loaded!.config.worker?.plugins?.()).toEqual(expect.arrayContaining([expectedPlugin]))
  })
})
