# 水体

`0.1.1` 的按需入口 `earthscene/engine/water` 提供 `WaterArea`，为已有完整引擎 WebGL Viewer 增加水色、法线波纹、太阳镜面和动态天空环境倒影。它复用当前地形几何，以水域掩膜区分陆地与水面，可与原有云、大气和时钟同时使用。

该模块包含材质、两张法线贴图、原生 Web Worker 与天空 cubemap 的管理。使用方不需要复制示例源码、安装 `workerpool` 或添加示例专用的 Vite 适配插件。底图、地形、令牌及具体水域边界由应用提供，包内不附带紫坪铺等业务数据。

## 接入已有场景

先按[快速开始](./getting-started.md)安装完整引擎及其 peer 依赖。下面的 `viewer` 是应用已经创建的 `earthscene/engine` WebGL Viewer：

```ts
import { WaterArea, type WaterAreaGeoJSON } from 'earthscene/engine/water'

// 此路径由应用部署，内容应为实际的 WGS84 水域面数据。
const response = await fetch('/data/water.geojson')
if (!response.ok) throw new Error(`Water boundary request failed: ${response.status}`)
const waterGeoJSON: WaterAreaGeoJSON = await response.json()

const water = new WaterArea(viewer, {
  source: { type: 'geojson', data: waterGeoJSON },
  appearance: {
    color: '#06172d',
    waveStrength: 0.44,
  },
  optics: {
    environment: { enabled: true, intensity: 0.7 },
  },
})
```

`source` 必填。`WaterArea` 不创建 Viewer，也不修改应用选用的影像、地形或地图令牌。应将相机移到所提供边界覆盖的水域，并确保当前地形瓦片已经加载。

## 水域边界来源

### 应用提供的 GeoJSON

```ts
const water = new WaterArea(viewer, {
  source: { type: 'geojson', data: waterGeoJSON },
})
```

支持 `Polygon`、`MultiPolygon`，以及包含这些几何的 `Feature` 和 `FeatureCollection`；面内孔洞会保留。坐标使用 WGS84，顺序为 `[经度, 纬度]`，前两项单位为度。空几何会被忽略。不要传入 GCJ-02、BD-09 或米制投影坐标。

应用负责读取或下载数据，并保留其来源与许可要求。Worker 使用已提供的数据生成掩膜，不再请求边界网络服务；地形、影像等原场景资源仍按各自配置加载。

### 可选 OSM Shortbread

需要在线大范围水域时，显式选择 OSM：

```ts
const water = new WaterArea(viewer, {
  source: { type: 'osm' },
})
```

省略 `url` 时使用原案例的公开服务：

```text
https://vector.openstreetmap.org/shortbread_v1/{z}/{x}/{y}.mvt
```

可指定提供相同 Shortbread 图层结构的服务：

```ts
water.source = {
  type: 'osm',
  url: 'https://example.com/water/{z}/{x}/{y}.mvt',
}
```

自定义模板必须同时包含 `{z}`、`{x}`、`{y}`，跨域服务需允许 CORS。OSM 来源按海洋、水域和桥梁等相关图层生成掩膜，不接受任意 MVT 图层布局。应用应保留 OpenStreetMap 署名，并核对数据许可、服务条款、配额与网络可用性。离线部署宜提供自己的 GeoJSON 或服务。

在线掩膜失败不会阻塞地形解析，但相关水域可能不显示。不要把服务返回成功、瓦片加载数或底图中能看到湖泊，直接当作水体材质已生效。

## 初始化与运行时

外观和光学参数在初始化与运行时保持同样的领域结构：

```ts
water.appearance.show = true
water.appearance.color = '#06172d'
water.appearance.waveStrength = 0.6
water.appearance.waveSpeed = 0.4
water.appearance.assign({ roughness: 0.08, waveDirection: 160 })

water.optics.environment.enabled = true
water.optics.environment.intensity = 0.8
water.optics.assign({ environment: { intensity: 0.7 } })
```

| 参数 | 含义与范围 |
| --- | --- |
| `appearance.show` | 显示或隐藏水域外观 |
| `appearance.color` | 六位十六进制水色，如 `#06172d` |
| `appearance.colorMix` | 与原影像的颜色混合，`0–1` |
| `appearance.roughness` | 水面粗糙度，`0.05–0.8` |
| `appearance.waveStrength` | 波纹强度，`0–1` |
| `appearance.waveScale` | 波纹尺度，`0.25–4` |
| `appearance.waveSpeed` | 波纹流速参数，`0–2`，不是米每秒 |
| `appearance.waveDirection` | 波纹方向，单位为度，按 `360°` 周期归一化 |
| `optics.environment.enabled` | 是否启用天空环境倒影 |
| `optics.environment.intensity` | 天空环境倒影强度，`0–2` |

`appearance.toJSON()` 和 `optics.toJSON()` 返回当前配置的副本。更换水域数据时，给 `source` 赋一个新的来源对象；实例会重建掩膜并保留外观：

```ts
water.source = { type: 'geojson', data: nextWaterGeoJSON }
```

不要只原地修改原 GeoJSON 对象来请求更新。地图或地形的更换仍通过原 Viewer API 完成，水体会随当前地形重新接入。

## 加载状态与销毁

`water.status` 返回当前状态的快照：

```ts
const { loadedTiles, waterTiles, failedTiles, destroyed } = water.status
```

| 字段 | 含义 |
| --- | --- |
| `loadedTiles` | 已生成的掩膜瓦片数 |
| `waterTiles` | 含水域的掩膜瓦片数 |
| `failedTiles` | 掩膜加载失败数 |
| `destroyed` | 实例是否已经释放 |

这些计数用于诊断数据链路，不表示当前相机一定能看到水面。视野、边界覆盖、地形加载和光照均影响最终画面。

组件卸载或路由离开时，先销毁水体，再销毁依附的 Viewer：

```ts
water.destroy()
viewer.destroy()
```

`destroy()` 释放本实例的材质挂接、掩膜、Worker、法线和反射资源。Viewer 的最终生命周期仍由应用负责。

## 支持范围

- 仅支持 `earthscene/engine` 的 WebGL Viewer。不能传入原生 `Cesium.Viewer`，也不支持 WebGPU；默认入口 `earthscene` 和 `earthscene/cesium` 的 Cesium 扩展 API 保持不变。
- 使用原生 Web Worker 和 OffscreenCanvas，线程脚本内联在模块中，无需应用复制 Worker 文件或配置构建插件。严格 CSP 环境需要允许 `worker-src blob:`；法线资源也随库提供。
- 水域外观复用地形几何，不提供独立水位网格、流体模拟、波浪几何位移或测绘精度保证。
- 天空 cubemap 提供大气天空环境的镜面反射，不是 SSR，也不完整反射建筑、地形或体积云。云、大气与水体同时运行，不代表这些对象都进入水面反射。
- 雨、雪尚未实现。此水体模块的公开不表示全部示例效果均已封装或迁移到 Cesium。

源码实现、构建检查、npm 发布和浏览器视觉验证应分别记录。本指南说明接口与边界，不代替对应环境下的实际画面验收。
