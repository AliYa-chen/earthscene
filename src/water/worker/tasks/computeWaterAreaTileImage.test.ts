import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WaterAreaGeoJSON, WaterAreaSource } from '../../WaterAreaSource'
import { computeWaterAreaTileImage, projectWaterAreaGeoJSON } from './computeWaterAreaTileImage'

afterEach(() => vi.unstubAllGlobals())

describe('generic water source tasks', () => {
  it('preserves GeoJSON polygon holes, MultiPolygons, and null feature geometry', () => {
    const outer = [[10, 10], [12, 10], [12, 12], [10, 10]]
    const hole = [[10.5, 10.5], [11, 10.5], [11, 11], [10.5, 10.5]]
    const data: WaterAreaGeoJSON = {
      type: 'FeatureCollection', features: [
        { type: 'Feature', geometry: null },
        { type: 'Feature', geometry: { type: 'Polygon', coordinates: [outer, hole] } },
        { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [[outer], [hole]] } },
      ],
    }
    const projected = projectWaterAreaGeoJSON(data)
    expect(projected).toHaveLength(3)
    expect(projected[0].rings).toHaveLength(2)
    expect(projected[0].minX).toBeCloseTo(190 / 360)
    expect(projected[0].maxX).toBeCloseTo(192 / 360)
    expect(projectWaterAreaGeoJSON(data)).toBe(projected)
  })

  it('returns land outside user polygons without constructing canvas or requesting network', async () => {
    const fetch = vi.fn()
    const canvas = vi.fn()
    vi.stubGlobal('fetch', fetch)
    vi.stubGlobal('OffscreenCanvas', canvas)
    const source: WaterAreaSource = { type: 'geojson', data: {
      type: 'Polygon', coordinates: [[[10, 10], [12, 10], [12, 12], [10, 10]]],
    } }
    await expect(computeWaterAreaTileImage({ x: 0, y: 0, z: 4 }, source)).resolves.toEqual({ solid: 'land' })
    expect(fetch).not.toHaveBeenCalled()
    expect(canvas).not.toHaveBeenCalled()
  })

  it('overzooms OSM data from level 14 and caches the shared source tile', async () => {
    const fetch = vi.fn(async (_url: string, _options?: RequestInit) => new Response(new ArrayBuffer(0), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    const source: WaterAreaSource = { type: 'osm', url: 'https://maps.invalid/{z}/{x}/{y}.mvt' }
    await expect(computeWaterAreaTileImage({ x: 30, y: 40, z: 16 }, source)).resolves.toEqual({ solid: 'land' })
    await expect(computeWaterAreaTileImage({ x: 31, y: 41, z: 16 }, source)).resolves.toEqual({ solid: 'land' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toBe('https://maps.invalid/14/7/10.mvt')
  })

  it('sanitizes fetch errors and does not cache failed OSM requests', async () => {
    const fetch = vi.fn(async () => { throw new Error('failed https://user:secret@maps.invalid/?token=credential') })
    vi.stubGlobal('fetch', fetch)
    const source: WaterAreaSource = { type: 'osm', url: 'https://user:secret@maps.invalid/{z}/{x}/{y}?token=credential' }
    for (let i = 0; i < 2; i++) {
      await expect(computeWaterAreaTileImage({ x: 0, y: 0, z: 0 }, source)).rejects.toThrow('Water-area vector tile is unavailable or invalid.')
    }
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid XYZ coordinates and non-finite polygon coordinates', async () => {
    await expect(computeWaterAreaTileImage({ x: 4, y: 0, z: 1 }, { type: 'osm' })).rejects.toThrow('XYZ range')
    expect(() => projectWaterAreaGeoJSON({ type: 'Polygon', coordinates: [[[NaN, 1], [0, 0], [1, 1]]] })).toThrow('finite longitude')
  })
})
