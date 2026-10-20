import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Matrix4 } from 'three'
import type { Viewer } from '../Viewer'
import { WaterArea } from '../water/WaterArea'

const fixtures = vi.hoisted(() => ({ materials: [] as any[], overlays: [] as any[] }))
vi.mock('../water/WaterAreaMaterialPlugin', () => ({
  WaterAreaMaterialPlugin: class {
    appearance = { assign: vi.fn() }
    optics = { assign: vi.fn() }
    update = vi.fn()
    setEnvironment = vi.fn()
    dispose = vi.fn()
    constructor() { fixtures.materials.push(this) }
  },
}))
vi.mock('../water/WaterAreaOverlayPlugin', () => ({
  WaterAreaOverlayPlugin: class {
    dispose = vi.fn()
    constructor(readonly options: any) { fixtures.overlays.push(this) }
  },
}))
vi.mock('../water/WaterAreaImageOverlay', () => ({ WaterAreaTilesOverlay: class { constructor(readonly options: any) {} } }))
vi.mock('../water/WaterAreaNormalTexture', () => ({ createWaterAreaNormalTextures: () => [] }))
vi.mock('../water/WaterAreaSkyEnvironment', () => ({ WaterAreaSkyEnvironment: class { update = vi.fn(); dispose = vi.fn() } }))

function tileset() { return { registerPlugin: vi.fn(), unregisterPlugin: vi.fn() } }
function fixture() {
  let tick: ((event: any) => void) | undefined
  const viewer = {
    renderer: { type: 'webgl' },
    globe: { raw: tileset() },
    camera: { getState: () => ({ destination: { longitude: 103.5, latitude: 31 } }) },
    scene: { atmosphere: { getWorldToECEFMatrix: () => new Matrix4() } },
    clock: {
      currentTime: new Date('2026-10-20T05:00:00Z'),
      on: vi.fn((_type, listener) => { tick = listener }), off: vi.fn(),
    },
    destroy: vi.fn(),
  }
  return { viewer, tick: () => tick!({ currentTime: viewer.clock.currentTime, simulationDeltaSeconds: 1 }) }
}
const source = { type: 'geojson' as const, data: { type: 'Polygon' as const, coordinates: [[[103, 31], [104, 31], [104, 32], [103, 31]]] } }

beforeEach(() => { fixtures.materials.length = fixtures.overlays.length = 0 })

describe('WaterArea ownership and rebuilds', () => {
  it('only attaches its own plugins and never takes ownership of the Viewer', () => {
    const { viewer } = fixture()
    const water = new WaterArea(viewer as unknown as Viewer, { source })
    expect(viewer.globe.raw.registerPlugin).toHaveBeenCalledTimes(2)
    water.destroy(); water.destroy()
    expect(viewer.globe.raw.unregisterPlugin).toHaveBeenCalledTimes(2)
    expect(viewer.destroy).not.toHaveBeenCalled()
    expect(viewer.clock.off).toHaveBeenCalledTimes(1)
    expect(water.status.destroyed).toBe(true)
  })

  it('reattaches after globe rebuilds and ignores obsolete tile completions', () => {
    const { viewer, tick } = fixture()
    const water = new WaterArea(viewer as unknown as Viewer, { source })
    const oldCallback = fixtures.overlays[0].options.overlays[0].options.onTile
    water.appearance.color = '#003366'
    viewer.globe.raw = tileset()
    tick()
    expect(viewer.globe.raw.registerPlugin).toHaveBeenCalledTimes(2)
    expect(fixtures.materials[0].dispose).toHaveBeenCalled()
    oldCallback({ solid: 'water' })
    expect(water.status.loadedTiles).toBe(0)
    fixtures.overlays[1].options.overlays[0].options.onTile({ solid: 'water' })
    expect(water.status.waterTiles).toBe(1)
    expect(water.appearance.color).toBe('#003366')
    water.destroy()
  })

  it('replaces only water sources while retaining appearance and map ownership', () => {
    const { viewer, tick } = fixture()
    const water = new WaterArea(viewer as unknown as Viewer, { source })
    water.appearance.waveSpeed = 0.2
    const globe = viewer.globe.raw
    water.source = { type: 'osm' }
    tick()
    expect(viewer.globe.raw).toBe(globe)
    expect(water.source.type).toBe('osm')
    expect(water.appearance.waveSpeed).toBe(0.2)
    expect(fixtures.overlays[1].options.overlays[0].options.source.type).toBe('osm')
    water.destroy()
  })

  it('rejects unsupported renderer and malformed source before adding plugins', () => {
    const { viewer } = fixture()
    viewer.renderer.type = 'webgpu'
    expect(() => new WaterArea(viewer as unknown as Viewer, { source })).toThrow(/WebGL/)
    expect(viewer.globe.raw.registerPlugin).not.toHaveBeenCalled()
    viewer.renderer.type = 'webgl'
    expect(() => new WaterArea(viewer as unknown as Viewer, { source: { type: 'osm', url: 'https://example.test/missing-placeholders' } })).toThrow(/\{z\}/)
    expect(viewer.globe.raw.registerPlugin).not.toHaveBeenCalled()
  })
})
