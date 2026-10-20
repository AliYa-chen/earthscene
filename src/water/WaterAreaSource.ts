/** WGS84 经度、纬度及可选的其它坐标分量；前两项单位为度。 / WGS84 longitude, latitude and optional additional components, in degrees. */
export type WaterAreaGeoJSONPosition = readonly number[]

/** 水域 GeoJSON Polygon，可包含孔洞。 / A water GeoJSON Polygon, including optional holes. */
export interface WaterAreaGeoJSONPolygon {
  readonly type: 'Polygon'
  readonly coordinates: readonly (readonly WaterAreaGeoJSONPosition[])[]
}

/** 水域 GeoJSON MultiPolygon。 / A water GeoJSON MultiPolygon. */
export interface WaterAreaGeoJSONMultiPolygon {
  readonly type: 'MultiPolygon'
  readonly coordinates: readonly (readonly (readonly WaterAreaGeoJSONPosition[])[])[]
}

/** 水域面几何。 / A water polygon geometry. */
export type WaterAreaGeoJSONGeometry = WaterAreaGeoJSONPolygon | WaterAreaGeoJSONMultiPolygon

/** 水域 GeoJSON Feature；空几何会被忽略。 / A water GeoJSON Feature; null geometry is ignored. */
export interface WaterAreaGeoJSONFeature {
  readonly type: 'Feature'
  readonly geometry: WaterAreaGeoJSONGeometry | null
  readonly properties?: Readonly<Record<string, unknown>> | null
  readonly id?: number | string
}

/** 水域 GeoJSON FeatureCollection。 / A water GeoJSON FeatureCollection. */
export interface WaterAreaGeoJSONFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: readonly WaterAreaGeoJSONFeature[]
}

/** 用户提供的 WGS84 水域面数据；不包含任何内置业务区域。 / User-provided WGS84 water polygons without built-in business regions. */
export type WaterAreaGeoJSON = WaterAreaGeoJSONGeometry | WaterAreaGeoJSONFeature | WaterAreaGeoJSONFeatureCollection

/** 本地水域边界来源，不发起边界网络请求。 / A local water boundary source that makes no boundary network requests. */
export interface WaterAreaGeoJSONSource {
  readonly type: 'geojson'
  readonly data: WaterAreaGeoJSON
}

/** OSM Shortbread 矢量瓦片来源；自定义地址须提供相同图层结构并允许跨域。 / An OSM Shortbread vector-tile source; custom endpoints must expose the same layers and allow CORS. */
export interface WaterAreaOSMSource {
  readonly type: 'osm'
  /** 含 {z}/{x}/{y} 的瓦片模板；省略时请求 OSM 公共 Shortbread 服务。 / A {z}/{x}/{y} tile template; defaults to the public OSM Shortbread service. */
  readonly url?: string
}

/** 水域边界来源，显式选择本地 GeoJSON 或 OSM 矢量瓦片。 / A water boundary source explicitly selecting local GeoJSON or OSM vector tiles. */
export type WaterAreaSource = WaterAreaGeoJSONSource | WaterAreaOSMSource
