import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

// Run the actual example with scene/UI doubles, without a browser or WebGL.
function setup(defaultToken = '') {
  class Element {
    parentElement = null
    hidden = false
    clientWidth = 1000
    clientHeight = 800
    offsetWidth = 100
    offsetHeight = 50
    style = {}
  }
  class Tiles {
    events = new Map<string, Set<(event?: any) => void>>()
    addEventListener(name: string, listener: (event?: any) => void) {
      if (!this.events.has(name)) this.events.set(name, new Set())
      this.events.get(name)!.add(listener)
    }
    removeEventListener(name: string, listener: (event?: any) => void) {
      this.events.get(name)?.delete(listener)
    }
    dispatch(name: string, event?: any) {
      for (const listener of this.events.get(name) ?? []) listener(event)
    }
  }
  const layers: Array<{ id: string, tileset: Tiles, remove: ReturnType<typeof vi.fn> }> = []
  const viewer = {
    highlighter: { clear: vi.fn(), setHover: vi.fn(), set: vi.fn() },
    tilesets: { add: vi.fn((options: any) => {
      const layer = { id: options.id, tileset: new Tiles(), remove: vi.fn() }
      layers.push(layer)
      return layer
    }) },
    flyToTarget: vi.fn(), on: vi.fn(), off: vi.fn(), destroy: vi.fn(),
  }
  let viewerOptions: any
  let panel: any
  const controlsFrom = (schema: any): any => Object.fromEntries(Object.entries(schema)
    .filter(([key]) => key !== '$')
    .map(([key, value]: [string, any]) => [key, 'value' in value ? value.value : 'onClick' in value ? value.onClick : controlsFrom(value)]))
  const document = { querySelector: () => new Element() }
  const window: any = { addEventListener: vi.fn() }
  const bindings = {
    earthscene: { Viewer: function (_container: unknown, options: any) { viewerOptions = options; return viewer } },
    defaultCesiumIonToken: defaultToken,
    exampleMapServiceConfig: { createOverlays: () => [] },
    mountLocationReadout: () => ({ destroy: vi.fn() }),
    bootExampleI18n() {},
    t: (value: { en: string }, params: Record<string, unknown> = {}) =>
      value.en.replace(/\{(\w+)\}/g, (_, key) => String(params[key])),
    createEarthScenePanel: (factory: () => any) => {
      panel = { controls: controlsFrom(factory()), setStatus: vi.fn(), dispose: vi.fn() }
      return panel
    },
    HTMLElement: Element, document, window,
  }
  const source = readFileSync(new URL('./3d-tiles-picking.ts', import.meta.url), 'utf8')
  const js = ts.transpile(source.slice(source.indexOf('bootExampleI18n()')), {
    target: ts.ScriptTarget.ES2021,
    module: ts.ModuleKind.None,
  })
  const api = new Function(...Object.keys(bindings), js + '\nreturn { loadTileset, clearActiveLayer };')(...Object.values(bindings))
  return { api, viewer, viewerOptions, panel, layers, window }
}

describe('3D Tiles picking example loading', () => {
  it('loads an official batch-table URL without requiring an Ion token or terrain', () => {
    const h = setup()
    expect(h.viewer.tilesets.add).toHaveBeenCalledWith(expect.objectContaining({
      source: {
        type: 'url',
        url: 'https://cdn.jsdelivr.net/gh/CesiumGS/cesium@621826db344eb7f1248f6bd50ed4770563127f12/Apps/SampleData/Cesium3DTiles/Batched/BatchedWithBatchTable/tileset.json',
      },
    }))
    expect(h.viewerOptions.terrain).toBeUndefined()
    expect(h.panel.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('Loading 3D Tiles'))
  })

  it('waits for a model before announcing success and flies to the loaded dataset', () => {
    const h = setup()
    const layer = h.layers[0]
    layer.tileset.dispatch('load-root-tileset')
    expect(h.viewer.flyToTarget).toHaveBeenCalledWith(layer.tileset, expect.any(Object))
    expect(h.panel.setStatus).toHaveBeenLastCalledWith('3D Tiles index loaded; loading models.')
    layer.tileset.dispatch('load-model')
    expect(h.panel.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('3D Tiles model loaded.'))
  })

  it('reports a failed request, clears the layer, and never exposes credential-bearing URLs', () => {
    const h = setup()
    const layer = h.layers[0]
    layer.tileset.dispatch('load-error', { error: new Error('HTTP 404 https://example.com/?access_token=secret') })
    expect(h.panel.setStatus).toHaveBeenLastCalledWith('3D Tiles failed to load (HTTP 404). Check the URL, access permissions or network.')
    expect(h.panel.setStatus.mock.calls.flat().join(' ')).not.toContain('secret')
    expect(layer.remove).toHaveBeenCalledOnce()
    expect([...layer.tileset.events.values()].every(listeners => listeners.size === 0)).toBe(true)
  })

  it('does not allow stale layer callbacks to change the current status or camera', () => {
    const h = setup()
    const oldLayer = h.layers[0]
    const oldRoot = [...oldLayer.tileset.events.get('load-root-tileset')!][0]
    const oldModel = [...oldLayer.tileset.events.get('load-model')!][0]
    const oldError = [...oldLayer.tileset.events.get('load-error')!][0]
    h.api.loadTileset()
    const calls = h.panel.setStatus.mock.calls.length
    oldRoot()
    oldModel()
    oldError({ error: new Error('HTTP 500') })
    expect(h.panel.setStatus).toHaveBeenCalledTimes(calls)
    expect(h.viewer.flyToTarget).not.toHaveBeenCalled()
    expect(oldLayer.remove).toHaveBeenCalledOnce()
    expect(h.layers[1].remove).not.toHaveBeenCalled()
  })

  it('supports explicit Ion credentials and the shared default token', () => {
    const h = setup('default-test-token')
    h.panel.controls.load.source = 'cesium-ion'
    h.panel.controls.load.assetId = '123'
    h.panel.controls.load.token = 'explicit-test-token'
    h.api.loadTileset()
    expect(h.viewer.tilesets.add).toHaveBeenLastCalledWith(expect.objectContaining({
      source: { type: 'cesium-ion', assetId: '123', apiToken: 'explicit-test-token' },
    }))
    h.panel.controls.load.token = ''
    h.api.loadTileset()
    expect(h.viewer.tilesets.add).toHaveBeenLastCalledWith(expect.objectContaining({
      source: { type: 'cesium-ion', assetId: '123', apiToken: 'default-test-token' },
    }))
  })

  it('validates missing Ion credentials and catches synchronous loader failures', () => {
    const h = setup()
    h.panel.controls.load.source = 'cesium-ion'
    h.panel.controls.load.assetId = '123'
    h.api.loadTileset()
    expect(h.viewer.tilesets.add).toHaveBeenCalledOnce()
    expect(h.panel.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('Enter asset id and token'))
    h.panel.controls.load.token = 'test-token'
    h.viewer.tilesets.add.mockImplementationOnce(() => { throw new Error('unsupported dataset') })
    h.api.loadTileset()
    expect(h.panel.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('3D Tiles failed to load or parse.'))
    expect(h.layers[0].remove).toHaveBeenCalledOnce()
  })
})
