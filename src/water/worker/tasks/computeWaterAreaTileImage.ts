import { VectorTile } from '@mapbox/vector-tile'
import Protobuf from 'pbf'
import type {
  WaterAreaGeoJSON,
  WaterAreaGeoJSONGeometry,
  WaterAreaGeoJSONPosition,
  WaterAreaOSMSource,
  WaterAreaSource,
} from '../../WaterAreaSource'
import type { WaterAreaTileCoordinate, WaterAreaTileImageResult } from '../types'

const DIMENSION = 128
const MAX_MERCATOR_LATITUDE = 85.0511287798066
const MAX_OSM_LEVEL = 14
const OSM_URL = 'https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt'
const WATER_LAYER_NAMES = ['ocean', 'water_polygons'] as const
const OCCLUDER_LAYER_NAMES = ['bridges', 'pier_polygons', 'dam_polygons', 'street_polygons', 'streets'] as const
const LAYERS = [...WATER_LAYER_NAMES, ...OCCLUDER_LAYER_NAMES]
type Point = readonly [number, number]
export interface ProjectedWaterPolygon {
  rings: Point[][]
  minX: number
  minY: number
  maxX: number
  maxY: number
}
interface TileFeature {
  type: number
  extent: number
  properties: Record<string, unknown>
  rings: Point[][]
}
type TileData = Map<string, TileFeature[]>
const geoJSONCache = new WeakMap<WaterAreaGeoJSON, ProjectedWaterPolygon[]>()
const osmCaches = new WeakMap<WaterAreaOSMSource, Map<string, Promise<TileData>>>()
let canvas: OffscreenCanvas | undefined
let context: OffscreenCanvasRenderingContext2D | undefined

function getCanvas(): { canvas: OffscreenCanvas; context: OffscreenCanvasRenderingContext2D } {
  if (!canvas || !context) {
    canvas = new OffscreenCanvas(DIMENSION, DIMENSION)
    context = canvas.getContext('2d', { willReadFrequently: true }) ?? undefined
    if (!context) throw new Error('Water-area mask canvas is unavailable.')
  }
  return { canvas, context }
}

function project(position: WaterAreaGeoJSONPosition): Point {
  const [longitude, latitude] = position
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('Water-area coordinates must contain finite longitude and latitude.')
  }
  const clamped = Math.max(-MAX_MERCATOR_LATITUDE, Math.min(MAX_MERCATOR_LATITUDE, latitude))
  const phi = clamped * Math.PI / 180
  return [(longitude + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2]
}

/** 将通用 WGS84 水域面预投影一次，保留孔洞和 MultiPolygon。 / Preproject generic WGS84 water polygons once, preserving holes and MultiPolygons. */
export function projectWaterAreaGeoJSON(data: WaterAreaGeoJSON): ProjectedWaterPolygon[] {
  const cached = geoJSONCache.get(data)
  if (cached) return cached
  const geometries: WaterAreaGeoJSONGeometry[] = []
  if (data.type === 'FeatureCollection') {
    for (const feature of data.features) if (feature.geometry) geometries.push(feature.geometry)
  } else if (data.type === 'Feature') {
    if (data.geometry) geometries.push(data.geometry)
  } else {
    geometries.push(data)
  }
  const polygons: ProjectedWaterPolygon[] = []
  for (const geometry of geometries) {
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      throw new Error('Water-area GeoJSON supports only Polygon and MultiPolygon geometries.')
    }
    const shapes = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    for (const shape of shapes) {
      const rings = shape.filter(ring => ring.length >= 3).map(ring => ring.map(project))
      if (!rings.length) continue
      const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
      for (const ring of rings) for (const [x, y] of ring) {
        bounds.minX = Math.min(bounds.minX, x)
        bounds.minY = Math.min(bounds.minY, y)
        bounds.maxX = Math.max(bounds.maxX, x)
        bounds.maxY = Math.max(bounds.maxY, y)
      }
      polygons.push({ rings, ...bounds })
    }
  }
  geoJSONCache.set(data, polygons)
  return polygons
}

function beginMask(): OffscreenCanvasRenderingContext2D {
  const { context } = getCanvas()
  // 与已有水域 shader 的 ImageBitmap 翻转约定一致。
  context.setTransform(1, 0, 0, -1, 0, DIMENSION)
  context.fillStyle = '#000'
  context.fillRect(0, 0, DIMENSION, DIMENSION)
  return context
}

function finishMask(): WaterAreaTileImageResult {
  const { canvas, context } = getCanvas()
  const pixels = context.getImageData(0, 0, DIMENSION, DIMENSION).data
  let allLand = true
  let allWater = true
  for (let index = 0; index < pixels.length && (allLand || allWater); index += 4) {
    allLand &&= pixels[index] === 0
    allWater &&= pixels[index] === 255
  }
  if (allLand) return { solid: 'land' }
  if (allWater) return { solid: 'water' }
  return { image: canvas.transferToImageBitmap() }
}

function computeGeoJSONMask(coordinate: WaterAreaTileCoordinate, data: WaterAreaGeoJSON): WaterAreaTileImageResult {
  const { x, y, z } = coordinate
  const scale = 2 ** z
  const minX = x / scale, minY = y / scale
  const maxX = (x + 1) / scale, maxY = (y + 1) / scale
  const visible = projectWaterAreaGeoJSON(data).filter(polygon =>
    polygon.maxX > minX && polygon.minX < maxX && polygon.maxY > minY && polygon.minY < maxY,
  )
  if (!visible.length) return { solid: 'land' }
  const context = beginMask()
  context.fillStyle = '#fff'
  for (const polygon of visible) {
    context.beginPath()
    for (const ring of polygon.rings) {
      ring.forEach(([mercatorX, mercatorY], index) => {
        const pixelX = (mercatorX * scale - x) * DIMENSION
        const pixelY = (mercatorY * scale - y) * DIMENSION
        if (!index) context.moveTo(pixelX, pixelY)
        else context.lineTo(pixelX, pixelY)
      })
      context.closePath()
    }
    context.fill('evenodd')
  }
  return finishMask()
}

function parseTile(buffer: ArrayBuffer): TileData {
  const vectorTile = new VectorTile(new Protobuf(buffer))
  const result: TileData = new Map()
  for (const name of LAYERS) {
    const layer = vectorTile.layers[name]
    if (!layer) continue
    const features: TileFeature[] = []
    for (let index = 0; index < layer.length; index++) {
      const feature = layer.feature(index)
      if (name === 'water_polygons' && feature.properties.kind === 'glacier') continue
      if ((name === 'street_polygons' || name === 'streets') && feature.properties.bridge !== true) continue
      features.push({
        type: feature.type,
        extent: layer.extent,
        properties: feature.properties,
        rings: feature.loadGeometry().map(ring => ring.map(point => [point.x, point.y] as Point)),
      })
    }
    result.set(name, features)
  }
  return result
}

async function fetchTile(coordinate: WaterAreaTileCoordinate, source: WaterAreaOSMSource): Promise<TileData> {
  const key = `${coordinate.z}/${coordinate.x}/${coordinate.y}`
  let cache = osmCaches.get(source)
  if (!cache) { cache = new Map(); osmCaches.set(source, cache) }
  const hit = cache.get(key)
  if (hit) { cache.delete(key); cache.set(key, hit); return hit }
  const url = (source.url ?? OSM_URL)
    .replaceAll('{z}', String(coordinate.z)).replaceAll('{x}', String(coordinate.x)).replaceAll('{y}', String(coordinate.y))
  const request = (async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error('Water-area vector tile request failed.')
      return parseTile(await response.arrayBuffer())
    } catch {
      cache!.delete(key)
      // 不包含可携带 token 或用户名密码的 URL。
      throw new Error('Water-area vector tile is unavailable or invalid.')
    } finally { clearTimeout(timeout) }
  })()
  cache.set(key, request)
  while (cache.size > 8) cache.delete(cache.keys().next().value!)
  return request
}

const roadWidths: Record<string, number | undefined> = {
  motorway: 3, trunk: 2.5, primary: 2, secondary: 1.5, tertiary: 1,
  unclassified: 1, residential: 1, busway: 1, bus_guideway: 1, pedestrian: 0.5,
  rail: 0.5, living_street: 0.5,
}

async function computeOSMMask(coordinate: WaterAreaTileCoordinate, source: WaterAreaOSMSource): Promise<WaterAreaTileImageResult> {
  const { x, y, z } = coordinate
  const dataLevel = Math.min(z, MAX_OSM_LEVEL)
  const factor = 2 ** (z - dataLevel)
  const dataX = Math.floor(x / factor), dataY = Math.floor(y / factor)
  const data = await fetchTile({ x: dataX, y: dataY, z: dataLevel }, source)
  if (!WATER_LAYER_NAMES.some(name => (data.get(name)?.length ?? 0) > 0)) return { solid: 'land' }
  const context = beginMask()
  const offsetX = x - dataX * factor, offsetY = y - dataY * factor
  for (const name of LAYERS) {
    const water = name === 'ocean' || name === 'water_polygons'
    context.fillStyle = water ? '#fff' : '#000'
    context.strokeStyle = '#000'
    for (const feature of data.get(name) ?? []) {
      if (feature.type !== 3 && name !== 'streets') continue
      context.beginPath()
      for (const ring of feature.rings) {
        ring.forEach(([tileX, tileY], index) => {
          const pixelX = (tileX / feature.extent * factor - offsetX) * DIMENSION
          const pixelY = (tileY / feature.extent * factor - offsetY) * DIMENSION
          if (!index) context.moveTo(pixelX, pixelY)
          else context.lineTo(pixelX, pixelY)
        })
        if (feature.type === 3) context.closePath()
      }
      if (name === 'streets') {
        const width = roadWidths[String(feature.properties.kind)] ?? 0.3
        context.lineWidth = width * 2 ** (z - 14) * 0.5
        context.stroke()
      } else {
        context.fill('evenodd')
      }
    }
  }
  return finishMask()
}

/** 在 Worker 中将水域边界生成 128px 掩膜，结果与已有水面 shader 方向一致。 / Generate a 128px water mask in a Worker using the existing shader orientation. */
export async function computeWaterAreaTileImage(
  coordinate: WaterAreaTileCoordinate, source: WaterAreaSource,
): Promise<WaterAreaTileImageResult> {
  const { x, y, z } = coordinate
  if (!Number.isInteger(z) || z < 0 || z > 30 || !Number.isInteger(x) || !Number.isInteger(y) ||
    x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) {
    throw new Error('Water-area tile coordinate is outside its valid XYZ range.')
  }
  if (source.type === 'geojson') return computeGeoJSONMask(coordinate, source.data)
  if (source.type === 'osm') return await computeOSMMask(coordinate, source)
  throw new Error('Unsupported water-area source.')
}
