# Cesium 适配与渐进迁移

EarthScene 保留现有项目结构、首页、示例与功能组织。包的根入口仍为 `src/index.ts`；现有业务继续使用 `import ... from "earthscene"`。Cesium 适配从独立子入口 `earthscene/cesium` 提供，不替换现有 Viewer，也不要求改写所有示例。

新增代码优先使用 Cesium 原生的地形、影像、相机、实体与场景 API。适合独立复用的视觉能力以插件形式提供，后续按功能逐项迁移。保留完整源码不代表所有功能已接入 Cesium。

## 将云插件接入原生 Cesium

体积云不要求使用额外的 Viewer 封装。可以把 `VolumetricClouds` 直接安装到已有的 Cesium Viewer：

```ts
import {
  EllipsoidTerrainProvider,
  Viewer as CesiumViewer,
  buildModuleUrl,
} from "cesium"
import "cesium/Build/Cesium/Widgets/widgets.css"
import { VolumetricClouds } from "earthscene/cesium"

// 将 Cesium 安装包中的 Assets、Workers、Widgets 和 ThirdParty
// 目录部署在站点的 /cesium/ 下。
buildModuleUrl.setBaseUrl("/cesium/")

const nativeViewer = new CesiumViewer("viewer", {
  baseLayer: false,
  baseLayerPicker: false,
  geocoder: false,
  terrainProvider: new EllipsoidTerrainProvider(),
})

const clouds = new VolumetricClouds(nativeViewer, {
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

## 可选的 Viewer 适配器

需要统一创建与销毁时，子入口也提供一个薄封装。它接收 Cesium 原生构造选项，通过 `raw` 公开原生实例，并通过 `use()` 管理可选插件：

```ts
import { Cartesian3 } from "cesium"
import { Viewer, volumetricClouds } from "earthscene/cesium"

const viewer = new Viewer("viewer")
const clouds = viewer.use(volumetricClouds({
  coverage: 0.35, altitude: 2500, thickness: 650,
}))

viewer.raw.camera.setView({
  destination: Cartesian3.fromDegrees(103.58072, 31.05158, 1673),
})

// 地形、影像、实体及相机继续调用 viewer.raw 的原生 Cesium API。
clouds.options.coverage = 0.5
viewer.destroy()
```

适配器默认不启用任何特效。`use()` 同时返回插件的运行时对象；同一个标识的插件不能重复安装。也可以通过构造选项 `plugins` 安装初始化插件，或通过 `removePlugin("volumetric-clouds")` 提前移除云。

`viewer.destroy()` 逆序销毁所有已安装插件，再销毁原生 Viewer。直接使用 `new VolumetricClouds(nativeViewer)` 时，应由业务生命周期显式调用 `clouds.destroy()`；不要为同一个场景重复创建未销毁的插件实例。

## 云的参数与实现边界

云插件使用 Cesium 公共 `PostProcessStage` 接口，利用场景深度与世界坐标重建进行球壳内的体积采样。低分辨率云缓冲在全分辨率阶段合成，质量档位决定采样次数与云缓冲分辨率。

可调整参数包括 `enabled`、`coverage`、`altitude`、`thickness`、`windSpeed`、`quality`、`detail`、`turbulence`、`shadows`、`haze` 与 `lightShafts`。高度与厚度的单位为米，风速单位为米/秒。`shadows` 在可见不透明表面上估算云影；`lightShafts` 估算薄雾中的遮光散射。云内遮挡、地表云影和光束均为实时采样近似。

当前实现仅在 3D 模式、相机高度低于 100 千米时启用，射线有效距离上限为 120 千米。它没有移植原渲染链的多重散射查找表、完整多尺度天气贴图或时间重投影管线，也未承诺视觉结果一致。

Cesium 自带的大气、太阳与时间系统由原生场景管理。插件不接管这些系统，也不更改相机、地形或影像配置。后续仍需分别验证云层上下穿越、地形遮挡、日落、HDR、透明物体、不同显卡和各采样质量的表现。

## 当前迁移范围

当前增加的是 Cesium 适配入口、可选 Viewer 薄封装和体积云插件。已有 Three.js 功能、首页、示例、编辑器与文档组织继续保留。其它视觉能力需要逐项分析后以独立方法库或插件接入，不能据此认定整套引擎已迁移。
