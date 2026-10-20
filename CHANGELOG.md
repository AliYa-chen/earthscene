# 更新记录

## [Unreleased]

## [0.1.0] - 2026-10-20

- 建立 EarthScene 独立项目与 Git 仓库。
- 复制并整理现有源码、测试、示例、资产和工程资料，保留原始 MIT 许可。
- 保留完整 Three.js 引擎与示例组织，新增可直接接入原生 Cesium Viewer 的 `ESClouds` 体积云扩展；完整迁移尚未完成。
- Cesium 入口提供 `ES` 命名空间与 `ESPluginHost` 插件管理器，由应用管理原生 Viewer 的创建、配置和销毁。
- 提供 `earthscene@0.1.0` npm 发布产物：默认 Cesium 扩展入口、同等 `earthscene/cesium` 子入口、独立完整引擎入口 `earthscene/engine`、TypeScript 声明和按需 peer 依赖。
- 首页视频改为 16.12 MB 本地 MP4，并修复示例控件、公开点云/拾取数据源和夜光 WMTS。
- 清除继承的发布、部署和远端配置。

迁移前记录见 [历史资料](./notes/archive/pre-migration-changelog.md)。
