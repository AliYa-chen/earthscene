---
name: earthscene
description: Application guidance for the default Three.js API and incremental Cesium adapters/plugins. Use for Viewer init, overlays, terrain, 3D Tiles, models, entities, atmosphere, clouds, postProcess, highlighter, camera, picking, and HISM. Do not use as a source for implementing the earthscene library itself.
---

# EarthScene 应用开发与迁移参考

> EarthScene 是完整的独立项目，默认入口 `src/index.ts` / `earthscene` 仍使用现有 Three.js 实现，保留首页、文档、Sandcastle 和完整示例。`pnpm dev` 使用 `scripts/dev.mjs`。不要改成独立的默认云场景，也不要把迁移提示放入核心产品流程。
>
> Cesium 适配与插件通过 `src/cesium/index.ts` / `earthscene/cesium` 单独使用，面向原生 Cesium API；逐项迁移适合的能力，其他效果作为方法库或插件扩展。尚未全量迁移，不能将下文默认 API 自动视为 Cesium 功能。以 `docs/guide/project-status.md` 与各模块实现为准。
>
> 本项目版本起点是 0.1.0，npm 包名为 `earthscene`。下文旧版本号仅为继承 API 的历史背景。示例依赖的固定源码已包含在 `vendor/`，不要求外部同级仓库。

下文维护默认 Three.js 入口的 Viewer、影像、地形、3D Tiles、实体、大气、体积云与后处理用法。涉及 Cesium 子模块时，直接核对其导出和原生 Cesium 类型，不套用默认入口的单位或对象结构。

原生 Cesium 应用可直接使用扩展，不需要创建第二个 Viewer：

```ts
import { VolumetricClouds } from 'earthscene/cesium'
const clouds = new VolumetricClouds(nativeViewer, { coverage: 0.5 })
// 原生 Cesium 的 terrainProvider、imageryLayers、camera、clock 仍由应用管理。
clouds.options.coverage = 0.7
clouds.destroy()
```

Cesium 扩展入口已按 `1.146.0` 做类型与包入口检查；浏览器视觉效果需单独验证。插件只释放自身资源；使用方必须在销毁原生 Viewer 前显式销毁手动安装的插件。完整说明见 `docs/guide/cesium-migration.md`。

示例令牌优先级为浏览器 `earthscene:cesium-ion-token` 覆盖值，再回退 `.env.local` 的 `VITE_CESIUM_ION_TOKEN`。不将真实令牌写入库源码、日志或文档；这项默认值仅用于示例。

## 何时使用本 skill

当用户在做以下任何一件事时启用：

- 初始化 `earthscene.Viewer`、配置场景 / 相机 / 渲染器
- 加载或切换地形、影像图层（XYZ / WMS / WMTS / MVT / GeoJSON / Cesium Ion）
- 加载 3D Tiles 或在经纬度放置 glTF 模型（点云可用 Cesium 形 `pointCloudShading`）
- 绘制点 / 线 / 面实体，以及屏幕空间图标与文字标注
- 配置大气、光照模式、体积云、后处理
- 相机飞行 / 定位、鼠标交互、拾取、高度采样
- HISM 大规模实例化（森林、岩石场、多 LOD、实例拾取）
- 把自定义 Three.js 对象按经纬高放到地球上

## 核心约定（先读这一段）

这些是产出代码前必须遵守的硬性约定，违反会导致代码不可用或语义错误。

### 1. 安装与导入

EarthScene 的 `three`、`3d-tiles-renderer` 和 `@takram/*` 是 peer dependency，应用侧必须显式安装：

```bash
pnpm add earthscene three 3d-tiles-renderer postprocessing @mapbox/tiny-sdf three-mesh-bvh \
  @takram/three-geospatial @takram/three-geospatial-effects \
  @takram/three-atmosphere @takram/three-clouds
# 用 MVT 矢量瓦片时再加（可选）：
npm install @mapbox/vector-tile pbf
```

导入：默认导出 `earthscene` 对象 + 命名导出类 / 类型。

```ts
import earthscene from '../src'
// 也可按需导入类型
import type { ViewerOptions, ImageryLayerOptions } from '../src'
```

### 2. 单位与坐标系（高频踩坑点）

- **经纬度、heading / pitch / roll 用「度」**，不是弧度。
- **高度、near / far、云层高度用「米」**（WGS84 椭球海拔）。
- 太阳 / 月亮角半径（`sunAngularRadius` 等）是**弧度**。
- heading / pitch / roll 相对**当地东北天（ENU）**坐标系。
- **经纬高元组输入顺序是 `[经度, 纬度, 高度]`**（遵循 GeoJSON），和对象 `{ longitude, latitude, height }` 字段顺序相反——混用极易出错。

```ts
// 元组：[经度, 纬度, 高度]
viewer.sampleHeight([121.4737, 31.2304])
// 对象
viewer.sampleHeight({ longitude: 121.4737, latitude: 31.2304 })
```

### 3. 必须确保容器有尺寸

```css
#viewer { width: 100vw; height: 100vh; }
```

容器宽高为 0 时 Viewer 仍会创建，但画面不显示，这是最常见的"白屏"原因。

### 4. 销毁时机

`viewer.destroy()` 应放在**组件卸载 / SPA 路由切换**时调用，不要只挂在 `beforeunload`（浏览器卸载时同步释放不可靠）：

```ts
useEffect(() => {
  const viewer = new earthscene.Viewer(container, options)
  return () => viewer.destroy()
}, [])
```

### 5. WebGPU 是实验性能力

用 `renderer.type: 'webgpu'` 时：

- 用 `await earthscene.Viewer.create(...)`（异步工厂），不要用 `new Viewer(...)` 后立刻渲染。
- **体积云、SMAA / 抖动在 WebGPU 下不渲染**；星空、镜头光晕和 TAA 已支持。`taa` 默认关闭，LensFlare → TAA 的顺序固定，给 SMAA / 抖动开关赋值没有视觉效果。
- **瓦片 LOD 淡入淡出在 WebGPU 下不可用**，瓦片为直接切换。
- WebGPU **不会在不支持的环境自动回退 WebGL**，应用层需自行检测。

## 能力导航

产出代码前，先判断属于哪个领域，读对应的 reference 文件。**不要一次性把所有 reference 读进上下文**——按需读取，保持精简。

| 用户需求 | 读取的 reference |
| --- | --- |
| 初始化 Viewer、相机飞行、加影像/地形/3D Tiles/模型/实体、HISM 实例化 | `references/core-api.md` |
| 大气、光照模式、体积云、后处理、地表材质 | `references/scene-effects.md` |
| 鼠标事件、拾取坐标 / feature、高度采样 | `references/interaction.md` |
| 把自定义 Three.js 对象按经纬度放到地球 | `references/coordinates.md` |

判断不准时，先读 `references/core-api.md`——它覆盖了 80% 的高频场景。

## 产出代码的规范

1. **完整可运行**：包含 import、容器准备、Viewer 创建。不要只给"核心片段"让用户自己拼。
2. **文档与 skill reference 使用占位 URL**（`https://example.com/...`）；可运行示例中的真实服务地址见 `examples/` 源码与环境变量配置。
3. **配置用领域分组结构**：`scene.atmosphere.lighting.mode` 而不是拍平的 `atmosphereLightingMode`。初始化配置和运行时入口同构（路径一致）。
4. **代码后跟简短中文说明**：解释关键参数为什么这么取值、有什么副作用，不展开成长篇。
5. **标注限制**：若用到 WebGPU 下不可用的能力，在说明里点明。

## 查不到时的兜底

- 公开 API 全量签名：仓库内 `src/Viewer.ts`、`src/types/`、`src/Camera.ts`、`src/LayerManager.ts`。
- 用户向文档：仓库内 `docs/guide/`（相机、交互、地形影像、光照、大气效果、数据源、能力边界）和 `docs/api/types.md`（完整 `ViewerOptions` 配置项参考）。
- 当本 skill 的 reference 与源码冲突时，**以源码为准**，并回来更新 reference。

### 示例回归注意事项

点云和拾取默认公开测试样本，可通过面板切换自有 Ion 资产。不要重新硬编码当前账户不可访问的私有资产作为默认。昼夜影像夜光使用 NASA GIBS WMTS 自定义矩阵。Leva 的只读提示必须用 `type: 'hint'`，由本项目 vendored 控件实现支持；不把提示降为可编辑字符串。

官网为 `https://earth.2t.hk`，源码仓库为 `https://github.com/AliYa-chen/earthscene`。首页体积云视频使用 `examples/assets/media/` 本地 MP4，必须小于 18,000,000 字节；图片封面同目录，交由 Vite 输出哈希资源。
