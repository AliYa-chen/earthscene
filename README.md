# EarthScene

[官网 / Website](https://earth.2t.hk) · [GitHub](https://github.com/AliYa-chen/earthscene) · [npm](https://www.npmjs.com/package/earthscene)

[English](./README.en.md) | 中文

EarthScene 是面向 Web 三维地球应用的 npm 效果与插件库，目标是用少量配置把效果接入业务场景。npm 包提供已实现的效果和运行资源；业务项目传入自己创建的 Viewer、业务数据并选择参数。Viewer 生命周期、地形与影像、服务凭据及业务数据仍由应用管理。

**npm 默认入口 `earthscene` 为原生 CesiumJS Viewer 提供扩展**，默认导出 `ES` 命名空间；`earthscene/cesium` 是同一组 API 的显式子路径。完整 Three.js 引擎作为独立可选入口由 `earthscene/engine` 提供，既有首页和示例仍使用它。两个入口的能力分别维护，完整引擎中的效果不代表已经迁移到 Cesium。当前范围见 [项目状态](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/project-status.md)。

## 安装到你的项目

只使用原生 Cesium 扩展：

```bash
npm install earthscene cesium@1.146.0
```

```ts
import { ESClouds } from 'earthscene'
const clouds = new ESClouds(cesiumViewer, { coverage: 0.5 })
// 销毁扩展，原生 Cesium Viewer 继续运行。
clouds.destroy()
```

使用完整 Three.js 引擎时安装对应 peer 依赖：

```bash
npm install earthscene three@^0.184.0 3d-tiles-renderer@^0.4.27 postprocessing@6.39.1 \
  @takram/three-atmosphere@0.19.1 @takram/three-clouds@0.7.6 \
  @takram/three-geospatial@0.9.1 @takram/three-geospatial-effects@0.6.4 \
  @mapbox/tiny-sdf@^2.2.0 three-mesh-bvh@0.9.0
```


TypeScript 用户还需 `npm install -D @types/three@^0.184.1`。

完整引擎从独立子路径导入：

```ts
import earthscene from 'earthscene/engine'

const viewer = new earthscene.Viewer('viewer', options)
```

peer 均按需选择，不会因安装 `earthscene` 自动引入另一套渲染器。最后两个工具的运行代码已包含在库构建中，完整引擎的类型声明仍使用其类型。仅 Cesium 入口不需要这些依赖。

EarthScene 自身的内置贴图、Draco 解码器和 Basis 转码器由 npm 包随附并默认加载，应用构建时会解析这些资源，无需从示例目录复制静态文件。机器可读清单位于 `earthscene/assets/manifest.json`，列出的文件也可从 `earthscene/assets/<fileName>` 导入；完整引擎仍支持通过 `baseUrl` 或 `dracoDecoderPath` 指向应用自托管的资源。

### 为完整引擎增加水体

`0.1.1` 增加按需子入口 `earthscene/engine/water`，将水色、波纹、太阳镜面和天空环境倒影封装为 `WaterArea`。它接入已有的完整引擎 **WebGL Viewer**，与原云、大气和时钟配合：

```ts
import { WaterArea } from 'earthscene/engine/water'

const water = new WaterArea(viewer, {
  source: { type: 'geojson', data: waterGeoJSON },
  appearance: { color: '#06172d', waveStrength: 0.44 },
  optics: { environment: { enabled: true, intensity: 0.7 } },
})
water.appearance.waveStrength = 0.6
water.destroy() // 先于 viewer.destroy() 调用。
```

`waterGeoJSON` 由应用提供；也可显式选择 OSM Shortbread 在线来源。包内提供材质、法线、原生 Worker 和天空 cubemap，使用方无需复制示例源码、安装 `workerpool` 或添加 Vite 适配插件。不内置特定地图、令牌或紫坪铺数据。该入口仅支持完整引擎 WebGL，不能传入原生 Cesium Viewer，也不支持 WebGPU。天空倒影不包含建筑、地形或体积云的完整反射。雨、雪仍未实现。详细用法见 [水体指南](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/water-area.md)。


## 本地开发

```bash
pnpm install
pnpm dev
```

`pnpm dev` 继续使用 `scripts/dev.mjs`，同时启动原有示例站和文档站。默认访问首页 `http://127.0.0.1:5173/`；端口被占用时以终端输出为准。原有完整示例通过首页或 Sandcastle 访问。

```bash
pnpm type-check
pnpm test:run
pnpm build
```

示例依赖 `leva-vanilla` 与 `three-stylized` 的固定源码已放入 `vendor/`，通过 `file:vendor/...` 安装，无需克隆同级仓库。详见 [CONTRIBUTING.md](https://github.com/AliYa-chen/earthscene/blob/main/CONTRIBUTING.md)。地图服务仍需按服务要求配置 token；不要把私有 token 写入源码。


示例可从 `.env.local` 的 `VITE_CESIUM_ION_TOKEN` 读取默认令牌，右上角设置可覆盖或恢复默认；令牌不进入 npm 库产物。

示例生产构建使用浏览器 Web Worker；`workerpool` 的 Node.js 后端仅在示例构建中隔离，不需要为 EdgePages 添加 Node 内建模块 polyfill。

## 项目边界

### 作为 Cesium 扩展使用

默认入口 `earthscene` 直接接入由应用管理的原生 `Cesium.Viewer`。扩展类使用 EarthScene 的简写 `ES`，该入口不导出 `Viewer`：

```ts
import { ESClouds } from 'earthscene'

// nativeViewer 由应用自己创建、配置和销毁。
const clouds = new ESClouds(nativeViewer, { coverage: 0.5 })
clouds.options.altitude = 2500
clouds.destroy() // 只释放此扩展的资源。
```

也可使用 `import ES from 'earthscene'` 与 `new ES.Clouds(nativeViewer)`。需要统一管理多个插件时，使用 `new ESPluginHost(nativeViewer)`；它只管理插件，不创建或销毁原生 Viewer。

当前核对版本为 CesiumJS `1.146.0`。扩展接收业务应用已经创建的 `Cesium.Viewer`，自身不创建 Viewer，也不接管地形、影像、相机、时钟和业务数据。应用仍负责 Cesium 上游资源部署及场景生命周期；接入方式与效果限制见 [Cesium 扩展指南](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/cesium-migration.md)。

包名为 `earthscene`，首次公开版本为 `0.1.0`。维护者发布前运行 `pnpm release:check`；也可用 `pnpm pack --pack-destination artifacts` 生成本地安装包做验证。

### 能力与接入边界

- npm 默认入口 `earthscene` 与 `earthscene/cesium` 均映射到 `src/cesium/index.ts`，提供可附着于原生 Cesium 场景的扩展。
- `src/index.ts` 保留完整 Three.js 引擎的 Viewer 与领域 API，通过 `earthscene/engine` 发布；源码示例仍从 `../src` 导入。
- `earthscene/engine/water` 按需提供完整引擎 WebGL 的 `WaterArea`；默认 Cesium 入口保持原有 API。
- 产品按 npm 模块提供可组合的效果实现和所需运行资源；应用提供宿主 Viewer、业务数据与服务配置。
- Cesium 扩展入口与完整 Three.js 引擎入口是两条独立实现路径。新增 Cesium 能力以源码与验证结果为准，不把现有引擎 API 自动视为已迁移完成。
- 本项目独立维护于 `AliYa-chen/earthscene`；官网为 `https://earth.2t.hk`。npm 包使用同名 `earthscene`；旧部署和 CDN 脚本已删除。
- 部分示例仍引用外部图片、模型与地图服务，它们是数据来源。

## 许可

采用 [MIT 许可](https://github.com/AliYa-chen/earthscene/blob/main/LICENSE)。继承代码的原始版权与许可原文保存在 [third_party/licenses/upstream-MIT.txt](https://github.com/AliYa-chen/earthscene/blob/main/third_party/licenses/upstream-MIT.txt)，此文件是保留原始标识的唯一例外。新项目命名调整不改变第三方代码的权利归属。
