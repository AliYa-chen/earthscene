# EarthScene 项目状态

EarthScene 从 `0.1.0` 开始独立维护。完整保留首页、文档、Sandcastle、示例与功能组织，并逐项将适合的能力迁移到 CesiumJS。Cesium 不直接提供的效果以方法库或插件扩展，允许使用 Three.js。

**npm 默认入口 `earthscene` 提供 Cesium 扩展，默认导出 `ES` 命名空间。** 完整 Three.js 引擎通过 `earthscene/engine` 单独提供。现有首页和示例继续使用完整引擎，尚未全量迁移到 Cesium。

## 启动与目录

运行 `pnpm dev`，由 `scripts/dev.mjs` 启动原有示例站与文档站。首页通常为 `http://127.0.0.1:5173/`，端口冲突时以终端输出为准；原有完整示例仍通过首页与 Sandcastle 访问。

| 内容 | 当前定位 |
| --- | --- |
| `src/cesium/index.ts` / `earthscene`、`earthscene/cesium` | npm 默认扩展入口与同等 Cesium 子入口，接入原生 Cesium API |
| `src/index.ts` / `earthscene/engine` | 完整 Three.js 引擎入口，保留现有 Viewer 与领域 API |
| `src/water/index.ts` / `earthscene/engine/water` | 0.1.1 新增的按需水体入口，接入已有完整引擎 WebGL Viewer |
| 现有 `src/` 模块 | 当前可运行的 Three.js 功能实现，继续维护并逐项迁移 |
| `ESClouds` | 独立接入原生 Cesium 场景的体积云扩展，以实现和验证结果为准 |
| `ESPluginHost` | 管理附着于已有原生 Viewer 的插件，不创建或销毁原生 Viewer |
| `examples/` | 保留完整首页、示例与 Sandcastle 组织 |
| `vendor/` | 示例依赖的固定源码快照，无需外部同级仓库 |
| 现有完整引擎 API 与效果文档 | 描述 `earthscene/engine`，除非特别标明，不代表 Cesium 已支持 |
| `notes/` | 工程记录与维护笔记，历史版本号不属于本项目发布历史 |

## 已完成的独立化

源代码、测试、文档和原始资产已复制到仓库外的新目录，完成新项目命名。新项目使用独立 Git 目录和 `main` 分支，不继承 Git remote、提交历史或发布配置。代码名称、环境变量、DOM/CSS 标识、本地存储 key 和资产目录均使用新项目名称。旧发布、部署和 CDN 刷新入口已删除。

`leva-vanilla` 和 `three-stylized` 的示例所需源码固定在 `vendor/`，通过 `file:vendor/...` 安装。每个依赖的 `UPSTREAM.json` 记录来源和提交，保留其原始许可。

继承代码的原始 MIT 版权与许可按原文保存在 `third_party/licenses/upstream-MIT.txt`，这是命名清理的唯一例外。

## 逐项迁移原则

优先让 Cesium 负责地球、相机、地形、影像和 3D Tiles，按实际能力逐项替换实现，同时保持原有功能组织。原生 Cesium API 能直接使用时不再增加多余包装；扩展效果采用清晰的方法或插件边界。

`earthscene` 和 `earthscene/cesium` 的公开扩展类以 `ES` 开头，也可通过默认 `ES` 命名空间使用。这两个入口不导出 `Viewer`；原生 Viewer 的创建、配置和销毁始终归应用负责。仅完整 Three.js 引擎入口 `earthscene/engine` 保留其既有 Viewer API。源码示例中的 `../src` 与 npm 默认入口含义不同，复制到其它项目时，完整引擎代码应从 `earthscene/engine` 导入。接入范例见 [Cesium 扩展指南](./cesium-migration.md)。

云、大气及其他自定义渲染需要按 Cesium 的深度、地心坐标和渲染链路适配，不能仅通过替换 import 就认定完成。Three.js 扩展应明确相机同步、坐标变换、深度关系与资源销毁责任。Cesium 扩展与完整引擎可以并存，直到对应功能与验证支持切换。

## 水体与天气能力边界

`0.1.1` 将完整引擎 WebGL 水体封装为 `earthscene/engine/water` 的 `WaterArea`。它包含水域掩膜、材质、法线波纹、太阳镜面和动态天空环境 cubemap；原生 Worker 随包提供，使用方无需复制示例源码，也无需安装 `workerpool` 或示例构建适配插件。初始化和运行时分别通过 `appearance`、`optics` 使用同样的参数结构；应用显式提供 GeoJSON 或选择可选 OSM Shortbread 在线来源。接口及销毁顺序见 [水体指南](./water-area.md)。

水体适配已有完整引擎的 WebGL 地形，可与原体积云、大气和时间轴同时使用。它不更换影像或地形，不包含特定地图、令牌和紫坪铺业务数据；不是原生 Cesium 的水体插件，也不支持 WebGPU。天空环境倒影不等于 SSR，不包含建筑、地形、体积云的完整反射。

雨、雪尚未实现。保留完整示例和源码不表示所有效果均已封装为 npm 公共 API，也不表示所有效果已迁移到 Cesium。源码、构建、npm 发布及浏览器视觉验收是不同状态，按对应验证记录判断。

## 外部数据

部分示例仍依赖外部图片、模型、3D Tiles、Cesium Ion、天地图等服务。服务可用性和访问 token 不由本项目保证。这些地址是数据来源。项目官网为 [earth.2t.hk](https://earth.2t.hk)，公开源码在 [GitHub](https://github.com/AliYa-chen/earthscene)；npm 包名为 `earthscene`，从 `0.1.0` 开始独立版本。
