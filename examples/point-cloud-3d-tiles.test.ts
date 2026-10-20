import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import ts from 'typescript'

function setup() {
  class Element {}
  const layers: Array<{ source: any; events: Record<string, (event?: any) => void>; remove: ReturnType<typeof vi.fn> }> = []
  const viewer = {
    tilesets: {
      add: vi.fn((options: any) => {
        const events: Record<string, (event?: any) => void> = {}
        const layer = {
          source: options.source,
          events,
          pointCloudShading: {},
          tileset: { addEventListener: (name: string, handler: (event?: any) => void) => { events[name] = handler } },
          remove: vi.fn(),
        }
        layers.push(layer)
        return layer
      }),
    },
    flyToTarget: vi.fn(),
    destroy: vi.fn(),
  }
  const controlsFrom = (schema: any): any => Object.fromEntries(Object.entries(schema)
    .filter(([key]) => key !== '$')
    .map(([key, value]: [string, any]) => [key, 'value' in value ? value.value : 'onClick' in value ? value.onClick : controlsFrom(value)]))
  let panel: any
  const bindings = {
    earthscene: { Viewer: function () { return viewer } },
    bootExampleI18n() {}, t: (value: any) => value.en,
    defaultCesiumIonToken: '',
    exampleMapServiceConfig: { createOverlays: () => [] },
    createEarthScenePanel: (factory: () => any) => {
      panel = { controls: controlsFrom(factory()), setStatus: vi.fn(), dispose() {} }
      return panel
    },
    HTMLElement: Element,
    document: { querySelector: () => new Element() },
    window: { addEventListener() {} },
  }
  const source = readFileSync(new URL('./point-cloud-3d-tiles.ts', import.meta.url), 'utf8')
    .replace(/^import .*$/gm, '')
    .replaceAll('import.meta.env', '({})')
  const js = ts.transpile(source, { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.None })
  const api = new Function(...Object.keys(bindings), js + '\nreturn { loadPointCloudTileset };')(...Object.values(bindings))
  return { api, viewer, layers, panel }
}

describe('point-cloud example source loading', () => {
  it('automatically loads the pinned official URL without an ion token', () => {
    const h = setup()
    expect(h.layers).toHaveLength(1)
    expect(h.layers[0].source).toEqual({
      type: 'url',
      url: 'https://raw.githubusercontent.com/CesiumGS/cesium/621826db344eb7f1248f6bd50ed4770563127f12/Specs/Data/Cesium3DTiles/PointCloud/PointCloudRGB/tileset.json',
    })
    expect(h.panel.controls.load.assetId).toBe('')
    expect(h.viewer.flyToTarget).toHaveBeenCalledWith(expect.anything(), {
      offset: { heading: 30, pitch: -25, distance: 25 },
    })
  })

  it('requires explicit credentials for custom ion assets and retains the current source on invalid input', () => {
    const h = setup()
    h.panel.controls.load.source = 'ion'
    h.panel.controls.load.assetId = '123'
    h.api.loadPointCloudTileset()
    expect(h.layers).toHaveLength(1)
    expect(h.layers[0].remove).not.toHaveBeenCalled()
    h.panel.controls.load.token = 'user-provided-test-value'
    h.api.loadPointCloudTileset()
    expect(h.layers).toHaveLength(2)
    expect(h.layers[1].source).toEqual({ type: 'cesium-ion', assetId: '123', apiToken: 'user-provided-test-value' })
    expect(h.layers[0].remove).toHaveBeenCalledOnce()
    expect(h.viewer.flyToTarget).toHaveBeenLastCalledWith(expect.anything(), {
      offset: { heading: 30, pitch: -25 },
    })
  })

  it('ignores source events after replacement and reports current loading failures', () => {
    const h = setup()
    h.api.loadPointCloudTileset()
    h.panel.setStatus.mockClear()
    h.layers[0].events['load-error']({ error: new Error('stale failure') })
    h.layers[0].events['load-root-tileset']()
    h.layers[0].events['load-model']()
    expect(h.panel.setStatus).not.toHaveBeenCalled()
    h.layers[1].events['load-model']()
    expect(h.panel.setStatus).toHaveBeenLastCalledWith(expect.stringContaining('Point cloud displayed'))
    h.layers[1].events['load-error']({ error: new Error('HTTP 404') })
    expect(h.panel.setStatus).toHaveBeenCalledWith(expect.stringContaining('ion assets also require account access'))
  })
})
