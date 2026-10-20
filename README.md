# EarthScene

[官网 / Website](https://earth.2t.hk) · [GitHub](https://github.com/AliYa-chen/earthscene)

[English](./README.en.md) | 中文

EarthScene 是一个全新的独立三维地球项目。保留完整的首页、文档、Sandcastle、示例和功能组织，在此基础上逐项将适合的能力迁移到 **CesiumJS**；Cesium 不直接提供的渲染效果以方法库或插件扩展，允许使用 **Three.js**。

当前版本从 `0.1.0` 开始。源码、测试、示例与资产已经独立复制并完成命名调整。**默认入口仍使用现有 Three.js 实现，尚未全量迁移到 Cesium。** 新增的 Cesium 适配与效果插件通过 `earthscene/cesium` 单独使用，面向原生 Cesium API；不会替换默认首页或另设默认云场景。具体边界见 [项目状态](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/project-status.md)。

## 安装到你的项目

只使用原生 Cesium 扩展：

```bash
npm install earthscene cesium@1.146.0
```

```ts
import { VolumetricClouds } from 'earthscene/cesium'
const clouds = new VolumetricClouds(cesiumViewer, { coverage: 0.5 })
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

peer 均按需选择，不会因安装 `earthscene` 自动引入另一套渲染器。最后两个工具的运行代码已包含在库构建中，完整引擎的类型声明仍使用其类型。仅 Cesium 入口不需要这些依赖。

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

## 项目边界

### 作为 Cesium 扩展使用

构建产物中的 `earthscene/cesium` 可直接接入原生 Viewer，无需使用本项目的 Viewer 封装：

```ts
import { VolumetricClouds } from 'earthscene/cesium'

// nativeViewer 由应用自己创建、配置和销毁。
const clouds = new VolumetricClouds(nativeViewer, { coverage: 0.5 })
clouds.options.altitude = 2500
clouds.destroy() // 只释放此扩展的资源。
```

当前核对版本为 CesiumJS `1.146.0`。插件不导入 Three.js，不替换地形、影像、相机或时钟配置；使用方仍负责 Cesium 的资源部署及场景生命周期。接入方式与限制见 [Cesium 扩展指南](https://github.com/AliYa-chen/earthscene/blob/main/docs/guide/cesium-migration.md)。

包名为 `earthscene`，首次公开版本为 `0.1.0`。维护者发布前运行 `pnpm release:check`；也可用 `pnpm pack --pack-destination artifacts` 生成本地安装包做验证。

### 保留的工程结构

- 默认包入口为 `src/index.ts`，保留现有 Viewer、领域 API 与完整示例组织。
- `src/cesium/index.ts` / `earthscene/cesium` 是独立的 Cesium 适配与插件入口，可在原生 Cesium 场景中使用；已有能力按模块逐项迁移。
- 默认渲染暂时保留 Three.js。新增 Cesium 能力以源码与验证结果为准，不把现有 API 自动视为已迁移完成。
- 本项目独立维护于 `AliYa-chen/earthscene`；官网为 `https://earth.2t.hk`。npm 包使用同名 `earthscene`；旧部署和 CDN 脚本已删除。
- 部分示例仍引用外部图片、模型与地图服务，它们是数据来源。

## 许可

采用 [MIT 许可](https://github.com/AliYa-chen/earthscene/blob/main/LICENSE)。继承代码的原始版权与许可原文保存在 [third_party/licenses/upstream-MIT.txt](https://github.com/AliYa-chen/earthscene/blob/main/third_party/licenses/upstream-MIT.txt)，此文件是保留原始标识的唯一例外。新项目命名调整不改变第三方代码的权利归属。
