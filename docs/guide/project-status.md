# EarthScene 项目状态

EarthScene 从 `0.1.0` 开始独立维护。完整保留首页、文档、Sandcastle、示例与功能组织，并逐项将适合的能力迁移到 CesiumJS。Cesium 不直接提供的效果以方法库或插件扩展，允许使用 Three.js。

**当前默认入口和默认渲染仍是现有 Three.js 实现，尚未全量迁移到 Cesium。** 新增 Cesium 适配与插件作为独立子模块使用，不替换默认首页或另设默认云场景。

## 启动与目录

运行 `pnpm dev`，由 `scripts/dev.mjs` 启动原有示例站与文档站。首页通常为 `http://127.0.0.1:5173/`，端口冲突时以终端输出为准；原有完整示例仍通过首页与 Sandcastle 访问。

| 内容 | 当前定位 |
| --- | --- |
| `src/index.ts` / `earthscene` | 默认包入口，保留现有 Viewer 与领域 API |
| 现有 `src/` 模块 | 当前可运行的 Three.js 功能实现，继续维护并逐项迁移 |
| `src/cesium/index.ts` / `earthscene/cesium` | 独立的 Cesium 适配与插件入口，面向原生 Cesium API |
| Cesium 体积云插件 | 独立接入 Cesium 场景的扩展能力，以实现和验证结果为准 |
| `examples/` | 保留完整首页、示例与 Sandcastle 组织 |
| `vendor/` | 示例依赖的固定源码快照，无需外部同级仓库 |
| 现有 API 与效果文档 | 描述当前默认实现，除非特别标明，不代表 Cesium 已支持 |
| `notes/` | 工程记录与维护笔记，历史版本号不属于本项目发布历史 |

## 已完成的独立化

源代码、测试、文档和原始资产已复制到仓库外的新目录，完成新项目命名。新项目使用独立 Git 目录和 `main` 分支，不继承 Git remote、提交历史或发布配置。代码名称、环境变量、DOM/CSS 标识、本地存储 key 和资产目录均使用新项目名称。旧发布、部署和 CDN 刷新入口已删除。

`leva-vanilla` 和 `three-stylized` 的示例所需源码固定在 `vendor/`，通过 `file:vendor/...` 安装。每个依赖的 `UPSTREAM.json` 记录来源和提交，保留其原始许可。

继承代码的原始 MIT 版权与许可按原文保存在 `third_party/licenses/upstream-MIT.txt`，这是命名清理的唯一例外。

## 逐项迁移原则

优先让 Cesium 负责地球、相机、地形、影像和 3D Tiles，按实际能力逐项替换实现，同时保持原有功能组织。原生 Cesium API 能直接使用时不再增加多余包装；扩展效果采用清晰的方法或插件边界。

云、大气及其他自定义渲染需要按 Cesium 的深度、地心坐标和渲染链路适配，不能仅通过替换 import 就认定完成。Three.js 扩展应明确相机同步、坐标变换、深度关系与资源销毁责任。新增适配与默认完整项目可以并存，直到对应功能与验证支持切换。

## 外部数据

部分示例仍依赖外部图片、模型、3D Tiles、Cesium Ion、天地图等服务。服务可用性和访问 token 不由本项目保证。这些地址是数据来源。项目官网为 [earth.2t.hk](https://earth.2t.hk)，公开源码在 [GitHub](https://github.com/AliYa-chen/earthscene)；未发布 npm。
