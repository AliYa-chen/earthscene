# Cesium 适配与渐进迁移

EarthScene 的 npm 默认入口 `earthscene` 提供 Cesium 扩展，直接接入应用已有的原生 `Cesium.Viewer`。`earthscene/cesium` 提供同一组 API。完整 Three.js 引擎从 `earthscene/engine` 导入；其源码仍为 `src/index.ts`，现有首页和源码示例继续使用该实现。

新增代码优先使用 Cesium 原生的地形、影像、相机、实体与场景 API。适合独立复用的视觉能力以插件形式提供，后续按功能逐项迁移。保留完整源码不代表所有功能已接入 Cesium。

安装：`npm install earthscene cesium@1.146.0`。仅使用此入口不需要 Three.js 或完整引擎的其它 peer 依赖。

## 将云插件接入原生 Cesium

体积云通过 `ESClouds` 安装到已有的 Cesium Viewer。`ES` 是 EarthScene 的简写，Cesium 扩展入口不导出 `Viewer`，以便与使用方的原生对象区分：

```ts
import {
  EllipsoidTerrainProvider,
  Viewer as CesiumViewer,
  buildModuleUrl,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import { ESClouds } from "earthscene"

// 将 Cesium 安装包中的 Assets、Workers、Widgets 和 ThirdParty
// 目录部署在站点的 /cesium/ 下。
buildModuleUrl.setBaseUrl("/cesium/")

const nativeViewer = new CesiumViewer("viewer", {
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  terrainProvider: new EllipsoidTerrainProvider(),
})

const clouds = new ESClouds(nativeViewer, {
  coverage: 0.35,
  altitude: 2500,
  thickness: 650,
})

clouds.options.coverage = 0.6
clouds.setQuality("high")

// 页面或业务场景销毁时，先释放插件，再释放原生场景。
function destroyScene() {
  clouds.destroy()
  nativeViewer.destroy()
}
```

上述初始化不需要 Ion token，也不请求在线地形和影像。真实地形、在线影像与账号凭据由使用方通过 Cesium API 配置；插件不读取项目中的地图源配置或浏览器存储。

## 可选的插件管理器

需要统一管理插件生命周期时，使用 `ESPluginHost`。它接收应用已经创建的原生 Viewer，通过 `use()` 安装插件；应用继续直接使用原生 Cesium API：

```ts
import { Cartesian3 } from "cesium"
import { ESPluginHost, esClouds } from "earthscene"

// nativeViewer 是应用中已经创建的 Cesium.Viewer。
const host = new ESPluginHost(nativeViewer)
const clouds = host.use(esClouds({
  coverage: 0.35, altitude: 2500, thickness: 650,
}))

nativeViewer.camera.setView({
  destination: Cartesian3.fromDegrees(103.58072, 31.05158, 1673),
})

// 地形、影像、实体及相机继续调用 nativeViewer 的原生 Cesium API。
clouds.options.coverage = 0.5
host.destroy() // 仅释放此管理器安装的插件，nativeViewer 继续运行。
```

管理器默认不启用任何特效。`use()` 返回插件的运行时对象；同一个标识的插件不能重复安装。可以通过 `host.removePlugin("earthscene:clouds")` 提前移除云。`host.cesiumViewer` 是传入的原生 Viewer 只读引用。

`host.destroy()` 逆序销毁该管理器安装的插件，不销毁原生 Viewer。直接使用 `new ESClouds(nativeViewer)` 时，应由业务生命周期显式调用 `clouds.destroy()`。销毁原生 Viewer 前先释放对应插件；不要为同一个场景重复创建未销毁的插件实例。

## 默认命名空间与具名导出

喜欢统一命名空间时，可以使用默认导出的 `ES`：

```ts
import ES from "earthscene"

const clouds = new ES.Clouds(nativeViewer, { coverage: 0.5 })
clouds.destroy()

const host = new ES.PluginHost(nativeViewer)
host.use(ES.clouds({ coverage: 0.5 }))
host.destroy()
```

对应的具名导出是 `ESClouds`、`ESPluginHost`、`esClouds`，也提供具名 `ES` 命名空间。`CloudOptions` 与 `CesiumPlugin` 等类型可按需导入。上述导入也可使用 `earthscene/cesium` 子路径。所有形式都只增加所选扩展，原生 Viewer 的所有权保持在应用侧。

## 云的参数与实现边界

云插件使用 Cesium 公共 `PostProcessStage` 接口，利用场景深度与世界坐标重建进行球壳内的体积采样。低分辨率云缓冲在全分辨率阶段合成，质量档位只调整采样次数；云缓冲固定为半分辨率，避免运行时切换质量造成后处理重新排序。

可调整参数包括 `enabled`、`coverage`、`altitude`、`thickness`、`windSpeed`、`quality`、`detail`、`turbulence`、`shadows`、`haze` 与 `lightShafts`。高度与厚度的单位为米，风速单位为米/秒。`shadows` 在可见不透明表面上估算云影；`lightShafts` 估算薄雾中的遮光散射。云内遮挡、地表云影和光束均为实时采样近似。

当前实现仅在 3D 透视模式、相机高度低于 100 千米时启用；原生正交相机保留原状且不启用此效果，射线有效距离上限为 120 千米。它没有移植原渲染链的多重散射查找表、完整多尺度天气贴图或时间重投影管线，也未承诺视觉结果一致。

Cesium 自带的大气、太阳与时间系统由原生场景管理。插件不接管这些系统，也不更改相机、地形或影像配置。后续仍需分别验证云层上下穿越、地形遮挡、日落、HDR、透明物体、不同显卡和各采样质量的表现。

## 当前迁移范围

当前增加的是 Cesium 扩展入口、可选插件管理器和体积云插件。已有 Three.js 功能、首页、示例、编辑器与文档组织继续保留。其它视觉能力需要逐项分析后以独立方法库或插件接入，不能据此认定整套引擎已迁移。
