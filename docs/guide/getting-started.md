# 快速开始

EarthScene 的 npm 默认入口 `earthscene` 是 Cesium 扩展库。应用继续使用原生 `Cesium.Viewer`，按需安装特效和插件。完整 Three.js 引擎另由 `earthscene/engine` 提供；两种入口的能力与 API 分别维护。

## 安装 Cesium 扩展

```bash
npm install earthscene cesium@1.146.0
```

只使用默认扩展入口，无需安装 Three.js。`earthscene/cesium` 提供相同导出。

## 接入原生 Viewer

已有原生 Viewer 时，直接传入它：

```ts
import { ESClouds } from 'earthscene'

const clouds = new ESClouds(cesiumViewer, { coverage: 0.5 })
clouds.options.altitude = 2500

// 组件卸载或移除特效时释放插件，原生 Viewer 继续运行。
clouds.destroy()
```

从空页面开始时，先部署 Cesium 安装包中的 `Assets`、`Workers`、`Widgets` 和 `ThirdParty` 目录到 `/cesium/`，准备有尺寸的容器，再创建原生 Viewer：

```html
<div id="viewer" style="width:100vw;height:100vh"></div>
```

```ts
import { EllipsoidTerrainProvider, Viewer, buildModuleUrl } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import ES from 'earthscene'

buildModuleUrl.setBaseUrl('/cesium/')
const cesiumViewer = new Viewer('viewer', {
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  terrainProvider: new EllipsoidTerrainProvider(),
})
const clouds = new ES.Clouds(cesiumViewer, { coverage: 0.5 })

function destroyScene() {
  clouds.destroy()
  cesiumViewer.destroy()
}
```

这里关闭在线影像并使用椭球地形，因此无需 Ion token。真实影像、地形、相机和时钟均通过原生 Cesium 配置。多个插件可用 `ESPluginHost` 统一管理，其 `destroy()` 只释放插件。参数、生命周期和当前视觉限制见 [Cesium 扩展指南](./cesium-migration.md)。

## 可选：完整 Three.js 引擎

保留的完整引擎为数字地球、数字孪生与三维地图提供统一领域 API；它与上面的 Cesium 扩展入口使用不同的 Viewer 和渲染链路，完整示例中的效果并不表示已由 Cesium 实现。

### 安装

```bash
npm install earthscene three@^0.184.0 3d-tiles-renderer@^0.4.27 postprocessing@6.39.1 \
  @takram/three-atmosphere@0.19.1 @takram/three-clouds@0.7.6 \
  @takram/three-geospatial@0.9.1 @takram/three-geospatial-effects@0.6.4 \
  @mapbox/tiny-sdf@^2.2.0 three-mesh-bvh@0.9.0
```

这些依赖是完整引擎需要的按需 peer。TypeScript 项目还需 `npm install -D @types/three@^0.184.1`。

### 创建完整引擎 Viewer

```ts
import earthscene from 'earthscene/engine'

const viewer = new earthscene.Viewer('viewer', {
  terrain: {
    type: 'url',
    url: 'https://example.com/terrain/'
  },
  overlays: [
    {
      source: {
        type: 'xyz',
        url: 'https://example.com/imagery/{z}/{y}/{x}',
        levels: 19
      }
    }
  ],
  camera: {
    destination: {
      longitude: 121.4737,
      latitude: 31.2304,
      height: 1200
    },
    orientation: {
      pitch: -25
    }
  }
})
```

### 资源路径

EarthScene 默认从 `/draco/` 加载 **完整** Draco 解码器（同时支持 glTF mesh 和点云）。应用侧需要把 three.js 的 `examples/jsm/libs/draco/` 解码器文件放到对应公开目录。如果你的路径不是 `/draco/`，通过 `dracoDecoderPath` 指定：

```ts
const viewer = new earthscene.Viewer(container, {
  dracoDecoderPath: '/assets/draco/'
})
```

`/draco/gltf/` 是体积更小的 glTF 专用 decoder，只能解三角网格，**不能**解 Draco 压缩的点云（`.pnts`）。只有确定不加载点云时才改用它。

### 销毁

不再使用 Viewer 时（例如单页应用路由切换、组件卸载），调用 `destroy()` 释放 WebGL 资源、控制器、已加载纹理和事件监听器，避免 GPU 内存泄漏和事件回调残留。

```ts
// 单页应用 / 框架组件卸载时销毁（推荐时机）
viewer.destroy()
```

在 React / Vue 这类框架里，应在组件卸载生命周期里销毁：

```ts
// React 示例
useEffect(() => {
  const viewer = new earthscene.Viewer(container, options)
  return () => {
    viewer.destroy()
  }
}, [])
```

::: tip 页面关闭时的兜底
页面卸载（`beforeunload` / `pagehide`）时浏览器已经在回收标签页，同步的 WebGL 资源释放通常不可靠，**不要把销毁只挂在页面关闭事件上**。优先在组件卸载或路由切换时销毁；如需兜底，可以额外监听 `pagehide`（比 `beforeunload` 更适合做清理）。
:::
